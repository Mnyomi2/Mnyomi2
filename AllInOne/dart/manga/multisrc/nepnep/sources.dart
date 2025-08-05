import '../../../../model/source.dart';

import 'src/en/mangasee/mangasee.dart';
import 'src/en/mangalife/mangalife.dart';

const nepnepVersion = "0.0.7";
const nepnepSourceCodeUrl =
    "https://raw.githubusercontent.com/Mnyomi2/Mnyomi2/refs/heads/main/AllInOne/dart/manga/multisrc/nepnep/nepnep.dart";

List<Source> get nepnepSourcesList => _nepnepSourcesList;
List<Source> _nepnepSourcesList =
    [
          //MangaSee (EN)
          mangaseeSource,
          //MangaLife (EN)
          mangalifeSource,
        ]
        .map(
          (e) =>
              e
                ..itemType = ItemType.manga
                ..sourceCodeUrl = nepnepSourceCodeUrl
                ..version = nepnepVersion,
        )
        .toList();
