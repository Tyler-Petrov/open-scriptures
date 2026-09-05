import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("builder", Path(__file__).with_name("build-strongs.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SourceTagsTest(unittest.TestCase):
    def test_keeps_multiple_tags(self):
        tokens, _ = builder.token_codes("word[G1][G2]")
        self.assertEqual(tokens[0][1], ["G1", "G2"])

    def test_detached_tags_are_not_lost(self):
        tokens, _ = builder.token_codes("word[G1] [G2][G3]")
        self.assertEqual(tokens[0][1], ["G1", "G2", "G3"])

    def test_supplied_word_has_no_codes(self):
        tokens, _ = builder.token_codes("<em>did</em> understand[G1][G2]")
        spans = builder.project_spans("did understand", tokens)
        self.assertEqual(spans, [["did", 0, 1], [" ", 0], ["understand", ["G1", "G2"]]])

    def test_phrase_links_skip_supplied_words_and_their_explicit_tags(self):
        tokens, _ = builder.token_codes("a <em>supplied[G3]</em> phrase[G1][G2]")
        self.assertEqual(tokens, [("a", ["G1", "G2"], 0), ("supplied", 0, 1), ("phrase", ["G1", "G2"], 0)])

    def test_whole_supplied_phrase_and_detached_tags_have_no_links(self):
        tokens, _ = builder.token_codes("<em>was there</em>[G3]")
        self.assertEqual(tokens, [("was", 0, 1), ("there", 0, 1)])

    def test_mismatched_text_is_not_rewritten(self):
        tokens, _ = builder.token_codes("different[G1][G2]")
        self.assertIsNone(builder.project_spans("word", tokens))


if __name__ == "__main__":
    unittest.main()
