import 'package:flutter/src/widgets/framework.dart';
import 'package:worfrontend/components/card_components/card_component.dart';
import 'package:worfrontend/components/player_deck/player_deck_state.dart';
import 'package:worfrontend/services/network/models/card.dart';

class DeckPlayed extends PlayerDeckState {
  final Card card;

  const DeckPlayed(this.card);

  @override
  build(BuildContext context) {
    return CardComponent(card: card);
  }
}