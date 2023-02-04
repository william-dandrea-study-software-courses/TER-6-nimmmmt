export interface Player {
  id: string;
  is_logged: boolean;
  cards: Card[];
  played_cards: Card[];
  in_player_game_property: InPlayerGameProperty | null;

  gameResult: PlayerGameResult;
}

export interface Card {
  value: number;
  cattleHead: number;
}

export interface InPlayerGameProperty {
  played_card: Card | null;
  had_played_turn: boolean;
  player_discard: Card[];
}

export interface PlayerGameResult {
  cattleHeads: number;
  ranking: number;
}