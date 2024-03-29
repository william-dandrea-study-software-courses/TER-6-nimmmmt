import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ChooseStackCardPlayerAction,
  Game,
  GameDocument,
  NextRoundPlayerAction,
} from '../schema/game.schema';
import { Model } from 'mongoose';
import { WebsocketGateway } from './websocket.gateway';
import { DuringRoundService } from './main-engine/during-round.service';
import { GameResultService } from './main-engine/game-result.service';
import { InitializeGameService } from './main-engine/initialize-game.service';
import { RoundResultService } from './main-engine/round-result.service';
import { StartGameService } from './main-engine/start-game.service';
import { PlayerNotFoundException } from './main-engine/exceptions/player-not-found.exception';
import { GameNotFoundException } from './main-engine/exceptions/game-not-found.exception';
import { UserNotFoundWhenJoinGameException } from './main-engine/exceptions/user-not-found-when-join-game.exception';
import { NotEnoughPlayersForStartingGameException } from './main-engine/exceptions/not-enough-players-for-starting-game.exception';
import { PlayerAlreadyPlayedCardException } from './main-engine/exceptions/player-already-played-card.exception';
import { PlayerDontHaveCardException } from './main-engine/exceptions/player-dont-have-card.exception';
import { StackNotFoundException } from './main-engine/exceptions/stack-not-found.exception';
import { EngineUtilsService } from './main-engine/engine-utils.service';
import {
  DURATION_PLAYER_CHOOSE_CARDS_IN_SECONDS,
  DURATION_PLAYER_CHOOSE_STACK_CARDS_IN_SECONDS,
  MAX_ROUND_NUMBER
} from '../config';

@Injectable()
export class GameEngineService implements OnModuleInit {
  private readonly logger: Logger = new Logger();

  private idCurrentSetTimeoutPlayerChoose;
  private idChooseAutomaticStackAfterTimeout;

  private lastTableMessage: string = '';

  constructor(
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly webSocketGateway: WebsocketGateway,
    private readonly duringRoundService: DuringRoundService,
    private readonly gameResultService: GameResultService,
    private readonly initializeGameService: InitializeGameService,
    private readonly roundResultService: RoundResultService,
    private readonly startGameService: StartGameService,
  ) { }

  onModuleInit(): any { }

  public async tableCreateNewGame(): Promise<void> {
    const game: Game = await this.startGameService.generateNewGame();
    this.lastTableMessage = 'CREATE_NEW_GAME';
    await this.webSocketGateway.sendNewGameValueToTable(
      game,
      'CREATE_NEW_GAME',
    );

    clearTimeout(this.idCurrentSetTimeoutPlayerChoose);
  }

  public async playerJoinGame(player_id: string, username: string): Promise<void> {
    try {
      const game: Game = await this.initializeGameService.playerJoinGame(player_id, username);

      const indexPlayer: number = game.players.findIndex(
        (p) => p.id === player_id,
      );

      await this.webSocketGateway.sendPlayerInfosToPlayer(
        game.players[indexPlayer],
        'PLAYER_LOGGED_IN_GAME',
      );

      this.lastTableMessage = 'TABLE_PLAYER_JOIN';
      await this.webSocketGateway.sendNewGameValueToTable(
        game,
        'TABLE_PLAYER_JOIN',
      );
    } catch (error) {
      if (error instanceof GameNotFoundException) {
        this.logger.error('Game not found');
      }

      if (error instanceof UserNotFoundWhenJoinGameException) {
        this.logger.error('User not found when he tried to join game');

        await this.webSocketGateway.sendPlayerError(
            player_id,
            'WRONG_ID_PLAYER',
        );
      }

      this.logger.error('Unhandled error: ', error);
    }
  }

  public async tableStartGame(): Promise<void> {
    try {
      const game: Game = await this.initializeGameService.launchGame();

      this.lastTableMessage = 'START_GAME';
      await this.webSocketGateway.sendNewGameValueToTable(game, 'START_GAME');
      await this.webSocketGateway.sendNewGameValueToPhone(game, 'START_GAME_VALUE');

      for (const p of game.players) {
        await this.webSocketGateway.sendPlayerInfosToPlayer(p, 'START_GAME');
      }

      this.verifyAndExecuteTimeOutForRound();
    } catch (error) {
      if (error instanceof GameNotFoundException) {
        this.logger.error('Game not found');
      }

      if (error instanceof NotEnoughPlayersForStartingGameException) {
        this.logger.error('Not enough players for starting the game');
      }
    }
  }

  public async playerPlayedCard(player_id: string, card_value: number,): Promise<void> {

    try {
      const game: Game = await this.duringRoundService.newPlayerPlayed(player_id, card_value);
      this.lastTableMessage = 'NEW_PLAYER_PLAYED_CARD';
      await this.webSocketGateway.sendNewGameValueToTable(game, 'NEW_PLAYER_PLAYED_CARD',);
      await this.webSocketGateway.sendNewGameValueToPhone(game, 'PHONE_NEW_PLAYER_PLAYED_CARD');

      const indexPlayer: number = game.players.findIndex(
        (p) => p.id === player_id,
      );

      await this.webSocketGateway.sendPlayerInfosToPlayer(game.players[indexPlayer], 'CARD_PLAYED');

    } catch (error) {
      if (error instanceof GameNotFoundException) {
        this.logger.error("playerPlayedCard => ", error.message);
      }

      if (error instanceof PlayerNotFoundException) {
        this.logger.error("playerPlayedCard => ", error.message);
      }
      if (error instanceof PlayerAlreadyPlayedCardException) {
        this.logger.error("playerPlayedCard => ", error.message);
      }
      if (error instanceof PlayerDontHaveCardException) {
        this.logger.error("playerPlayedCard => ", error.message);
      }
    }
  }

  public async tableAllPlayerPlayed(): Promise<void> {
    try {
      if (await this.duringRoundService.isRoundFinished()) {

        clearTimeout(this.idCurrentSetTimeoutPlayerChoose);
        clearTimeout(this.idChooseAutomaticStackAfterTimeout);

        const gameWithFlipCard: Game = await this.roundResultService.flipCardOrder();

        this.lastTableMessage = 'FLIP_CARD_ORDER';
        await this.webSocketGateway.sendNewGameValueToTable(gameWithFlipCard, 'FLIP_CARD_ORDER',);
        await this.webSocketGateway.sendNewGameValueToPhone(gameWithFlipCard, 'PHONE_FLIP_CARD_ORDER');

        const game: Game = await this.roundResultService.generateNextAction();
        this.lastTableMessage = 'NEW_RESULT_ACTION';
        await this.webSocketGateway.sendNewGameValueToTable(game, 'NEW_RESULT_ACTION',);
        await this.webSocketGateway.sendNewGameValueToPhone(game, 'PHONE_NEW_RESULT_ACTION');

        if (game.in_game_property.between_round.current_player_action != null && game.in_game_property.between_round.current_player_action.action.type === "CHOOSE_STACK_CARD") {
          this.chooseAutomaticStackAfterTimeout();
        }

      }
    } catch (error) {
      if (error instanceof GameNotFoundException) {
        this.logger.error(error.message);
      } else if (error instanceof PlayerNotFoundException) {
        this.logger.error(error.message);
      } else if (error instanceof PlayerAlreadyPlayedCardException) {
        this.logger.error(error.message);
      } else if (error instanceof PlayerDontHaveCardException) {
        this.logger.error(error.message);
      } else if (error instanceof StackNotFoundException) {
        this.logger.error(error.message);
      } else {
        this.logger.error(error)
      }
    }
  }

  public async tableNextRoundResultAction(choosen_stack: number | null,): Promise<void> {

    try {
      const currentGame: Game = await EngineUtilsService.getCurrentGame(this.gameModel,);

      clearTimeout(this.idCurrentSetTimeoutPlayerChoose)
      clearTimeout(this.idChooseAutomaticStackAfterTimeout)


      // Si la précédente action est une action du type ChooseStackCardPlayerAction, on donne le choosen stack
      if (choosen_stack != null
        && currentGame.in_game_property.between_round.current_player_action != null
        && currentGame.in_game_property.between_round.current_player_action.action.type === "CHOOSE_STACK_CARD"
      ) {
        const newRoundGame: Game = await this.roundResultService.updateActionWhenChooseStackCard(choosen_stack);
      }

      const game: Game = await this.roundResultService.generateNextAction();

      if (game.in_game_property.between_round.current_player_action != null && game.in_game_property.between_round.current_player_action.action.type != "NEXT_ROUND") {
        this.lastTableMessage = 'NEW_RESULT_ACTION';
        await this.webSocketGateway.sendNewGameValueToTable(game, 'NEW_RESULT_ACTION',);
        await this.webSocketGateway.sendNewGameValueToPhone(game, 'PHONE_NEW_RESULT_ACTION');
        return;
      }


      if (choosen_stack == null && game.in_game_property.between_round.current_player_action != null && game.in_game_property.between_round.current_player_action.action.type === "CHOOSE_STACK_CARD") {
        this.chooseAutomaticStackAfterTimeout();
      }



      if (game.in_game_property.between_round.current_player_action != null
        && game.in_game_property.between_round.current_player_action.action.type === "NEXT_ROUND"
      ) {
        if (game.in_game_property.current_round === MAX_ROUND_NUMBER) {
          // Fin du jeu, envoie des resultats
          this.logger.log("END game result")
          const endGame: Game = await this.gameResultService.getResults();
          this.lastTableMessage = 'END_GAME_RESULTS';
          await this.webSocketGateway.sendNewGameValueToTable(endGame, 'END_GAME_RESULTS',);
          for (const p of endGame.players) {
            await this.webSocketGateway.sendPlayerInfosToPlayer(p, 'END_GAME_RESULTS',);
          }
        } else {

          if (this.lastTableMessage != "NEW_ROUND") {
            this.logger.log("New round game")
            const newRoundGame: Game = await this.duringRoundService.nextRound();
            this.lastTableMessage = 'NEW_ROUND';
            await this.webSocketGateway.sendNewGameValueToTable(newRoundGame, 'NEW_ROUND',);
            for (const p of newRoundGame.players) {
              await this.webSocketGateway.sendPlayerInfosToPlayer(p, 'NEW_ROUND');
            }

            this.verifyAndExecuteTimeOutForRound();
          }


        }
      }
    } catch (error) {
      let raised = false;
      if (error instanceof GameNotFoundException) {
        this.logger.error("tableNextRoundResultAction => ", error.message);
        raised = true;
      }
      if (error instanceof PlayerNotFoundException) {
        this.logger.error("tableNextRoundResultAction => ", error.message);
        raised = true;
      }
      if (error instanceof PlayerAlreadyPlayedCardException) {
        this.logger.error("tableNextRoundResultAction => ", error.message);
        raised = true;
      }
      if (error instanceof PlayerDontHaveCardException) {
        this.logger.error("tableNextRoundResultAction => ", error.message);
        raised = true;
      }
      if (error instanceof StackNotFoundException) {
        this.logger.error("tableNextRoundResultAction => ", error.message);
        raised = true;
      }

      if (!raised) {
        this.logger.error("tableNextRoundResultAction => Unexpected error: ", error.message);
      }
    }
  }




  private verifyAndExecuteTimeOutForRound() {
    this.idCurrentSetTimeoutPlayerChoose = setTimeout(async () => {
      const game = await EngineUtilsService.getCurrentGame(this.gameModel);

      this.logger.log("=========== TIMEOUT")

      for (const p of game.players) {
        if (!p.in_player_game_property.had_played_turn && p.cards[0] != null) {
          await this.playerPlayedCard(p.id, p.cards[0].value);
          this.logger.log("=========== " + p.id);
        }
      }

    }, DURATION_PLAYER_CHOOSE_CARDS_IN_SECONDS * 1000);
  }


  private chooseAutomaticStackAfterTimeout() {

    this.idChooseAutomaticStackAfterTimeout = setTimeout(async () => {
      const game = await EngineUtilsService.getCurrentGame(this.gameModel);

      this.logger.log("krjrekjrejkkejrkrekrekrekrekerkerkeklklerklre")

      await this.tableNextRoundResultAction(1);

    }, DURATION_PLAYER_CHOOSE_STACK_CARDS_IN_SECONDS * 1000);
  }



}
