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

    def test_phrase_and_supplied_word_keep_codes(self):
        tokens, _ = builder.token_codes("<em>did</em> understand[G1][G2]")
        spans = builder.project_spans("did understand", tokens)
        self.assertEqual(spans, [["did", ["G1", "G2"], 1], [" ", 0], ["understand", ["G1", "G2"]]])

    def test_mismatched_text_is_not_rewritten(self):
        tokens, _ = builder.token_codes("different[G1][G2]")
        self.assertIsNone(builder.project_spans("word", tokens))


if __name__ == "__main__":
    unittest.main()
