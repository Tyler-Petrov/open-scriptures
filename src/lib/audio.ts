// LibriVox KJV audio — public domain recordings streamed from archive.org.
// Assembled from per-book LibriVox "Bible (KJV)" projects (no single 66-file
// item exists on archive.org). Every URL below was verified with
// `curl -sIL` → HTTP 200 + multi-MB content-length on build day.
//
// Items used (all archive.org/download/{item}/{file}.mp3):
//   bible_kjv_01_02_03_0908_librivox (Gen/Exo/Lev)
//   numbers_kjv_1108_librivox, deuteronomy_kjv_1110_librivox
//   bible_kjv_joshua_jc_librivox, bible_judges_kjv_jc_librivox, bible_ruth_tg_librivox
//   bible_1samuel_kjv_0903_librivox, bible_2samuel_kjv_jc_librivox
//   bible_kjv_11_1king_0909_librivox, bible_kjv_2kings_jc_librivox
//   1chronicles_jc_librivox, bible_kjv_14_2chronicles_1110_librivox
//   ezra_kjv_sw_librivox, nehemiah_kjv_1110_librivox, bible_kjv_17_esther_dr_1502_librivox
//   job_kjv_1012_librivox, psalms_kjv_1202_librivox, proverbs_kjv_mp_librivox
//   ecclesiastes_kjv_1105_librivox, songofsolomon_kjv_1009_librivox
//   isaiah_kjv_1107_librivox, jeremiah_kjv_1201_librivox
//   bible_kjv_25_lamentations_mp_0909_librivox, ezekiel_kjv_jr_librivox, daniel_kjv_1112_librivox
//   minor_prophets_tg_librivox (Hos..Mal), joel_kjv_ss_librivox
//   matthew_kjv_mp_librivox, mark_kjv_sw_librivox, bible_kjv_nt_03_luke_0812_librivox
//   biblent04_john_kjv_librivox, acts_kjv_1112_librivox, romans_kjv_1103_librivox
//   1corinthians_kjv_1103_librivox, 2corinthians_kjv_1105_librivox
//   bible_4epistles_kjv_1104_librivox (Gal/Php/Col), ephesians_kjv_nt_librivox
//   bible_1thessalonians_kjv_1010_librivox, bible_2thessalonians_kjv_1011_librivox
//   bible_1timothy_kjv_1007_librivox, bible_2timothy_kjv_1009_librivox
//   bible_titus_kjv_1007_librivox, bible_philemon_kjv_1007_librivox, hebrews_kjv_1111_librivox
//   james_kjv, epistlesofpeter_kjv_1109_librivox, bible_epistlesjohn_rt_librivox
//   1John_kjv_librivox, jude_kjv, revelation_mp_librivox
//
// Note: BOOK_AUDIO holds ONE stream per book (contract shape Record<abbrev,string>).
// Where an item only ships chapter-grouped files, the entry points at the file
// that starts that book (e.g. "Genesis 1-6"), so playback starts at the book's
// beginning; books shipping a whole-book file start-to-end are used when available.

const ITEM = "https://archive.org/download";

export const BOOK_AUDIO: Record<string, string> = {
  Gen: `${ITEM}/bible_kjv_01_02_03_0908_librivox/bible_01a_kjv_64kb.mp3`,
  Exo: `${ITEM}/bible_kjv_01_02_03_0908_librivox/bible_02a_kjv_64kb.mp3`,
  Lev: `${ITEM}/bible_kjv_01_02_03_0908_librivox/bible_03a_kjv_64kb.mp3`,
  Num: `${ITEM}/numbers_kjv_1108_librivox/numbers_01_kjv_64kb.mp3`,
  Deu: `${ITEM}/deuteronomy_kjv_1110_librivox/deuteronomy_01_kjv_64kb.mp3`,
  Jos: `${ITEM}/bible_kjv_joshua_jc_librivox/joshua_01_kjv_64kb.mp3`,
  Jdg: `${ITEM}/bible_judges_kjv_jc_librivox/judges_01_kjv_64kb.mp3`,
  Rut: `${ITEM}/bible_ruth_tg_librivox/ruth_kjv_64kb.mp3`,
  "1Sa": `${ITEM}/bible_1samuel_kjv_0903_librivox/1samuel_01_kjv_64kb.mp3`,
  "2Sa": `${ITEM}/bible_2samuel_kjv_jc_librivox/2samuel_01_kjv_64kb.mp3`,
  "1Ki": `${ITEM}/bible_kjv_11_1king_0909_librivox/1kings_01_kjv_64kb.mp3`,
  "2Ki": `${ITEM}/bible_kjv_2kings_jc_librivox/2kings_01_kjv_64kb.mp3`,
  "1Ch": `${ITEM}/1chronicles_jc_librivox/1chronicles_01_kjv_64kb.mp3`,
  "2Ch": `${ITEM}/bible_kjv_14_2chronicles_1110_librivox/2chronicles_01_kjv_64kb.mp3`,
  Ezr: `${ITEM}/ezra_kjv_sw_librivox/ezra_01_kjv_64kb.mp3`,
  Neh: `${ITEM}/nehemiah_kjv_1110_librivox/nehemiah_1_kjv_64kb.mp3`,
  Est: `${ITEM}/bible_kjv_17_esther_dr_1502_librivox/esther_1_kjv_64kb.mp3`,
  Job: `${ITEM}/job_kjv_1012_librivox/job_01_kjv_64kb.mp3`,
  Psa: `${ITEM}/psalms_kjv_1202_librivox/psalms_01_kjv_64kb.mp3`,
  Pro: `${ITEM}/proverbs_kjv_mp_librivox/proverbs_01_kjv_64kb.mp3`,
  Ecc: `${ITEM}/ecclesiastes_kjv_1105_librivox/ecclesiastes01_kjv_64kb.mp3`,
  Sng: `${ITEM}/songofsolomon_kjv_1009_librivox/songofsolomon_1_kjv_64kb.mp3`,
  Isa: `${ITEM}/isaiah_kjv_1107_librivox/isaiah_01_kjv_64kb.mp3`,
  Jer: `${ITEM}/jeremiah_kjv_1201_librivox/jeremiah_01_kjv_64kb.mp3`,
  Lam: `${ITEM}/bible_kjv_25_lamentations_mp_0909_librivox/lamentations_1_kjv_64kb.mp3`,
  Ezk: `${ITEM}/ezekiel_kjv_jr_librivox/ezekiel_01_kjv_64kb.mp3`,
  Dan: `${ITEM}/daniel_kjv_1112_librivox/daniel_1_kjv_64kb.mp3`,
  Hos: `${ITEM}/minor_prophets_tg_librivox/minorprophets_01_kjv_64kb.mp3`,
  Jol: `${ITEM}/joel_kjv_ss_librivox/joel_1_kjv_64kb.mp3`,
  Amo: `${ITEM}/minor_prophets_tg_librivox/minorprophets_05_kjv_64kb.mp3`,
  Oba: `${ITEM}/minor_prophets_tg_librivox/minorprophets_07_kjv_64kb.mp3`,
  Jon: `${ITEM}/minor_prophets_tg_librivox/minorprophets_08_kjv_64kb.mp3`,
  Mic: `${ITEM}/minor_prophets_tg_librivox/minorprophets_09_kjv_64kb.mp3`,
  Nam: `${ITEM}/minor_prophets_tg_librivox/minorprophets_11_kjv_64kb.mp3`,
  Hab: `${ITEM}/minor_prophets_tg_librivox/minorprophets_12_kjv_64kb.mp3`,
  Zep: `${ITEM}/minor_prophets_tg_librivox/minorprophets_13_kjv_64kb.mp3`,
  Hag: `${ITEM}/minor_prophets_tg_librivox/minorprophets_14_kjv_64kb.mp3`,
  Zec: `${ITEM}/minor_prophets_tg_librivox/minorprophets_15_kjv_64kb.mp3`,
  Mal: `${ITEM}/minor_prophets_tg_librivox/minorprophets_18_kjv_64kb.mp3`,
  Mat: `${ITEM}/matthew_kjv_mp_librivox/matthew_01_kjv_64kb.mp3`,
  Mrk: `${ITEM}/mark_kjv_sw_librivox/gospelofmark_01_kjv_64kb.mp3`,
  Luk: `${ITEM}/bible_kjv_nt_03_luke_0812_librivox/luke_01-02_kjv_64kb.mp3`,
  Jhn: `${ITEM}/biblent04_john_kjv_librivox/gospeljohn_1_kjv_64kb.mp3`,
  Act: `${ITEM}/acts_kjv_1112_librivox/acts_01_kjv_64kb.mp3`,
  Rom: `${ITEM}/romans_kjv_1103_librivox/romans_1_kjv_64kb.mp3`,
  "1Co": `${ITEM}/1corinthians_kjv_1103_librivox/1corinthians_1_kjv_64kb.mp3`,
  "2Co": `${ITEM}/2corinthians_kjv_1105_librivox/2corinthians_1_kjv_64kb.mp3`,
  Gal: `${ITEM}/bible_4epistles_kjv_1104_librivox/4epistles_1_kjv_64kb.mp3`,
  Eph: `${ITEM}/ephesians_kjv_nt_librivox/ephesians_kjv_64kb.mp3`,
  Php: `${ITEM}/bible_4epistles_kjv_1104_librivox/4epistles_5_kjv_64kb.mp3`,
  Col: `${ITEM}/bible_4epistles_kjv_1104_librivox/4epistles_6_kjv_64kb.mp3`,
  "1Th": `${ITEM}/bible_1thessalonians_kjv_1010_librivox/1_thessalonians_01_kjv_64kb.mp3`,
  "2Th": `${ITEM}/bible_2thessalonians_kjv_1011_librivox/2_thessalonians_kjv_64kb.mp3`,
  "1Ti": `${ITEM}/bible_1timothy_kjv_1007_librivox/1_timothy_01_kjv_64kb.mp3`,
  "2Ti": `${ITEM}/bible_2timothy_kjv_1009_librivox/2_timothy_01_kjv_64kb.mp3`,
  Tit: `${ITEM}/bible_titus_kjv_1007_librivox/titus_01_kjv_64kb.mp3`,
  Phm: `${ITEM}/bible_philemon_kjv_1007_librivox/philemon_01_kjv_64kb.mp3`,
  Heb: `${ITEM}/hebrews_kjv_1111_librivox/hebrews_1_kjv_64kb.mp3`,
  Jas: `${ITEM}/james_kjv/james_01_kjv_64kb.mp3`,
  "1Pe": `${ITEM}/epistlesofpeter_kjv_1109_librivox/epistlesofpeter_1_kjv_64kb.mp3`,
  "2Pe": `${ITEM}/epistlesofpeter_kjv_1109_librivox/epistlesofpeter_2_kjv_64kb.mp3`,
  "1Jn": `${ITEM}/1John_kjv_librivox/1_john_kjv_64kb.mp3`,
  "2Jn": `${ITEM}/bible_epistlesjohn_rt_librivox/epistlesofjohn_6_kjv_64kb.mp3`,
  "3Jn": `${ITEM}/bible_epistlesjohn_rt_librivox/epistlesofjohn_7_kjv_64kb.mp3`,
  Jud: `${ITEM}/jude_kjv/jude_01_kjv_64kb.mp3`,
  Rev: `${ITEM}/revelation_mp_librivox/revelation_01_kjv_64kb.mp3`,
};

export function getBookAudio(abbrev: string): string | undefined {
  return BOOK_AUDIO[abbrev];
}
