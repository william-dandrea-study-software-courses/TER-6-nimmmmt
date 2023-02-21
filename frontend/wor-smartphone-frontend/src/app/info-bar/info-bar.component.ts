import { Component, Input } from '@angular/core';
import { Player } from '../model/player.model';

@Component({
  selector: 'app-info-bar',
  templateUrl: './info-bar.component.html',
  styleUrls: ['./info-bar.component.css']
})
export class InfoBarComponent {

  @Input()
  public player: Player | null = null;
  @Input()
  public gameStatus: string = "";
  @Input()
  public timer: number = 0;
  @Input()
  public isTimerVisible: boolean = false;
  public urlAvatar: string = "";
  public cattleHeads: number = 0;

  public colorCattleHeadBackground: string = '#FFF'


  ngOnInit(): void {
    this.urlAvatar = `/assets/avatars/${this.player?.avatar}.png`;

    this.cattleHeads = 0;
    this.player?.in_player_game_property?.player_discard.forEach(card => {
      this.cattleHeads += card.cattleHead;
      this.colorCattleHeadBackground = '#ff9c9c';
      setTimeout(() => {
        this.colorCattleHeadBackground = '#FFF';
      }, 2000)

    });
  }
}
