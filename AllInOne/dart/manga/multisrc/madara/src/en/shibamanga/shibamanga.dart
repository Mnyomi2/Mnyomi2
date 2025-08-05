import '../../../../../../../model/source.dart';

Source get shibamangaSource => _shibamangaSource;

Source _shibamangaSource = Source(
  name: "Shiba Manga",
  baseUrl: "https://shibamanga.com",
  lang: "en",

  typeSource: "madara",
  iconUrl:
      "https://raw.githubusercontent.com/Mnyomi2/Mnyomi2/refs/heads/main/AllInOne/dart/manga/multisrc/madara/src/en/shibamanga/icon.png",
  dateFormat: "MM/dd/yyyy",
  dateFormatLocale: "en_us",
);
