import unittest
from importlib import util
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "update-essence.py"
spec = util.spec_from_file_location("update_essence", SCRIPT_PATH)
update_essence = util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(update_essence)


class UpdateEssenceRegressionTests(unittest.TestCase):
    def test_counts_items_across_sections(self) -> None:
        data = {
            "sections": [
                {"items": [{"title": "a"}, {"title": "b"}]},
                {"items": [{"title": "c"}]},
                {},
            ]
        }

        self.assertEqual(3, update_essence.count_items(data))

    def test_detects_item_count_regression_by_default(self) -> None:
        existing = {"sections": [{"items": [{"title": str(index)} for index in range(28)]}]}
        generated = {"sections": [{"items": [{"title": str(index)} for index in range(12)]}]}

        self.assertEqual((28, 12), update_essence.regression_details(existing, generated))

    def test_allows_item_count_regression_when_explicit(self) -> None:
        existing = {"sections": [{"items": [{"title": str(index)} for index in range(28)]}]}
        generated = {"sections": [{"items": [{"title": str(index)} for index in range(12)]}]}

        self.assertIsNone(update_essence.regression_details(existing, generated, allow_regression=True))


if __name__ == "__main__":
    unittest.main()
