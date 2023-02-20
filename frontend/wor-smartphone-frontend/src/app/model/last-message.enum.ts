

export enum LastMessageEnum {
  PLAYER_LOGGED_IN_GAME,
  START_GAME,
  CARD_PLAYED,
  END_GAME_RESULTS,
  NEW_ROUND,
}


export enum LastGameMessageEnum {
  PHONE_NEW_PLAYER_PLAYED_CARD,
  PHONE_FLIP_CARD_ORDER,
  PHONE_NEW_RESULT_ACTION,
}


export enum GameStatusEnum {
  BEGINING,
  PLAYING,
  WAITING,
  END
}