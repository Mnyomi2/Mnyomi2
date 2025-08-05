import '../../../../../../../model/source.dart';

Source get readcomicsonlineSource => _readcomicsonlineSource;

Source _readcomicsonlineSource = Source(
  name: "Read Comics Online",
  baseUrl: "https://readcomicsonline.ru",
  lang: "en",

  typeSource: "mmrcms",
  iconUrl:
      "https://raw.githubusercontent.com/Mnyomi2/Mnyomi2/refs/heads/main/AllInOne/dart/manga/multisrc/mmrcms/src/en/readcomicsonline/icon.png",
  dateFormat: "d MMM. yyyy",
  dateFormatLocale: "en_us",
);
