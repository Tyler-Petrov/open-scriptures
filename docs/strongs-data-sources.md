# Strong's word links and data sources

Checked September 4, 2026 while extending PR #3.

A translation text, an original-language text, a lexicon, and the links between particular words
are distinct datasets. A Strong's number identifies a dictionary entry. A source-word ID identifies
an occurrence in a particular source verse; several occurrences can share one dictionary entry.

## What Blue Letter Bible documents

BLB's [March 2024 announcement](https://blogs.blueletterbible.org/blb/2024/03/08/remapped-hebrew-data/)
says its team remapped Hebrew to English for KJV and NASB95 between March 2021 and November 2023.
It describes over 46,000 verses, over 532,000 Hebrew words across both versions, and over 2,000
hours of work. It explicitly describes one-to-many and many-to-one relationships. This was
remapping its study data, not making new Bible translations. The announcement explains the
accuracy goal; it does not establish why every earlier mapping needed revision.

BLB's [FAQ and data credits](https://www.blueletterbible.bible/contact/contact_gen.cfm) describe
licensed use of Larry Pierce's Online Bible lexicon work, including Strong's, Thayer's, and
Brown–Driver–Briggs/Gesenius material. BLB asks people seeking reuse to describe the exact material
and intended use. We have not obtained a BLB data agreement, private API access, or export, and
have not found a documented public word-alignment API. Publicly viewable pages do not establish
that BLB offers a reusable dataset. This PR does not import BLB content or claim matching accuracy.

## Standards and open sources

[USFM's character-attribute specification](https://docs.usfm.bible/usfm/3.1.1/char/attributes.html)
defines `lemma`, `strong`, and `srcloc` attributes and supports multiple Strong's values. It also
allows older word markup without those attributes. Thus the standard can represent annotations,
but the existence of a translation file does not mean those annotations have been supplied.

[STEPBible-Data](https://github.com/STEPBible/STEPBible-Data) publishes data under CC BY 4.0,
including tagged Hebrew/Greek texts, lexicons, and Translators Tags for ESV. Its repository asks
for attribution and records of modifications. This is a candidate for a separate importer and
coverage review, not data included in this PR. Rights and editions of translation text need to
be checked separately from permission to use tagging data.

The current KJV source remains `kaiserlik/kjv`, aligned to the project's `aruljohn/Bible-kjv`
text. The shared dictionary remains the existing merged dataset. The source builder's phrase
propagation is inherited behavior, not an independently reviewed linguistic alignment. It now
preserves all tags instead of dropping every tag after the first. Other translations require
verified mappings for the exact edition. Merely putting Hebrew/Greek and English together,
or matching similar English words, does not supply those mappings.
