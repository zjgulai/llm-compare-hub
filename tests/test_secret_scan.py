import unittest

from scripts.secret_scan import SecretScanner


class SecretScannerTests(unittest.TestCase):
    def test_reports_secret_patterns_without_leaking_values(self) -> None:
        token = "ghp_" + ("A" * 36)
        private_key = (
            "-----BEGIN "
            + "OPENSSH PRIVATE KEY-----\n"
            + "not-a-real-key-body\n"
            + "-----END "
            + "OPENSSH PRIVATE KEY-----\n"
        )
        text = f'remote = "https://{token}@github.com/example/repo.git"\n{private_key}'

        findings = SecretScanner().scan_text("fixture.txt", text)

        rule_ids = {finding.rule_id for finding in findings}
        self.assertIn("github-token", rule_ids)
        self.assertIn("private-key", rule_ids)

        rendered = "\n".join(finding.render() for finding in findings)
        self.assertNotIn(token, rendered)
        self.assertNotIn("not-a-real-key-body", rendered)

    def test_ignores_placeholder_secret_values(self) -> None:
        text = "\n".join(
            [
                'API_KEY="YOUR_API_KEY"',
                'TOKEN="${{ secrets.GITHUB_TOKEN }}"',
                'password = "<redacted>"',
            ]
        )

        findings = SecretScanner().scan_text("example.env", text)

        self.assertEqual([], findings)


if __name__ == "__main__":
    unittest.main()
