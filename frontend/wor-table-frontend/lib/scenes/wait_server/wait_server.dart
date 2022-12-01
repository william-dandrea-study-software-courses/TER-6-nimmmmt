import 'package:flutter/src/widgets/container.dart';
import 'package:flutter/src/widgets/framework.dart';
import 'package:flutter/widgets.dart';

class WaitServerScene extends StatelessWidget {
  const WaitServerScene({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text("Waiting for server..."));
  }
}
