import { AfterViewInit, Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { GameService } from '../services/game.service';
import { Card, Player } from "../model/player.model";
import { Subscription } from "rxjs";
import { LastMessageEnum } from "../model/last-message.enum";
import { animate, state, style, transition, trigger } from '@angular/animations';
import { CardComponent } from './card/card.component';
import {Router} from "@angular/router";

@Component({
  selector: 'app-display-cards',
  templateUrl: './display-cards.component.html',
  styleUrls: ['./display-cards.component.css'],
  animations: [
    trigger('cardAnimation', [
      state('selected', style({
        transform: 'scale(' + window.innerHeight / 300 + ')',
        top: '40%'
      })),
      state('unselected', style({
        transform: 'rotate({{degree}}deg) translate(0, -80%)',
      }), { params: { degree: 0 } }),
      transition('unselected => selected', animate('800ms ease-in')),
      transition('selected => unselected', animate('800ms ease-out')),
      state('played', style({
        transform: 'translateY(-100vh)'
      })),
      transition('* => played', animate('500ms ease-in')),
    ])
  ]
})
export class DisplayCardsComponent implements OnInit, OnDestroy {
  @ViewChildren(CardComponent) cardElements: QueryList<CardComponent> = new QueryList<CardComponent>();

  private lastMessageSubscription: Subscription | null = null;
  private playerSubscription: Subscription | null = null;

  public player: Player | null = null;
  public loading: boolean = true;
  public end: boolean = false;
  public played: boolean = false;
  public selectedCard: Card | null = null;
  public urlAvatar: string = "";
  public cards: Card[] = [];
  public cattleHeads: number = 0;
  public timer: number = 60;

  // public cards: Card[] = [{ value: 30, cattleHead: 1, state: "unselected" }, { value: 97, cattleHead: 3, state: "unselected" },
  // { value: 44, cattleHead: 5, state: "unselected" }, { value: 15, cattleHead: 3, state: "unselected" },
  // { value: 12, cattleHead: 2, state: "unselected" }, { value: 10, cattleHead: 1, state: "unselected" },
  // { value: 9, cattleHead: 1, state: "unselected" }, { value: 8, cattleHead: 1, state: "unselected" },
  // { value: 7, cattleHead: 1, state: "unselected", }, { value: 6, cattleHead: 7, state: "unselected" }];

  constructor(private gameService: GameService, private router: Router) {
  }

  ngOnInit(): void {
    console.log(window.innerHeight, window.innerWidth)
    this.lastMessageSubscription = this.gameService.lastMessage$.subscribe(async lastMessage => {

      if (lastMessage === LastMessageEnum.START_GAME) {
        console.log("Start game")
        this.loading = false;
      }

      if (lastMessage === LastMessageEnum.CARD_PLAYED) {
        console.log("Card played")
        this.played = true;
      }

      if (lastMessage === LastMessageEnum.END_GAME_RESULTS) {
        console.log("End result");
        this.end = true;
        this.played = false;
      }

      if (lastMessage === LastMessageEnum.NEW_ROUND) {
        console.log("New Round");
        this.end = false;
        this.loading = false;
        this.played = false;
      }

    });

    this.playerSubscription = this.gameService.player$.subscribe(async player => {
      console.log("New player value", player)
      this.player = player;

      this.cards = this.player!.cards.sort((a, b) => (a.value > b.value) ? 1 : -1);
      this.cards.forEach(c => c.state = 'unselected');
      this.selectedCard = null;

      this.cattleHeads = 0;
      this.player?.in_player_game_property?.player_discard.forEach(card => this.cattleHeads += card.cattleHead);

      setInterval(() => {
        let end = new Date(this.player?.in_player_game_property?.chrono_up_to).getTime();
        let now = new Date().getTime();
        this.timer = Math.floor((end - now) / 1000) + 1;
      }, 1000);
      this.urlAvatar = `/assets/avatars/${this.player?.avatar}.png`;
    })
  }


  public newGame(): void {
    this.router.navigate(['']);
  }


  public play(): void {
    if (this.player && this.selectedCard) {
      console.log("Play card", this.selectedCard)
      this.cards.forEach(c => c.state = c === this.selectedCard ? 'played' : 'unselected');
      setTimeout(() => {
        this.gameService.playerPlayedCard(this.player!.id, this.selectedCard!.value);
      }, 1500);
    }
  }

  select(card: Card) {
    this.selectedCard = card;
    this.cards.forEach(c => c.state = c === card ? 'selected' : 'unselected');
  }

  public cancel(): void {
    this.selectedCard = null;
    this.cards.forEach(c => c.state = 'unselected');
  }

  ngOnDestroy(): void {
    this.lastMessageSubscription?.unsubscribe();
    this.playerSubscription?.unsubscribe();
  }

}
