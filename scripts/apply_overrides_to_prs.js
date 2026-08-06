// PRs that need updating
const overrides = [
  {
    number: 383,
    conventionalMessage: 'refactor(AccountPage): accountPage into smaller components',
  },
  {
    number: 382,
    conventionalMessage: 'refactor: simplify AppContent to improve code health',
  },
  {
    number: 381,
    conventionalMessage: 'refactor: refactor `FlaggedWishesSection` for Improved Readability',
  },
  {
    number: 380,
    conventionalMessage:
      'refactor(IdentityStickers): extract inner renderSticker function to simplify component',
  },
  {
    number: 378,
    conventionalMessage: 'refactor: simplify MatchingRulesSection for better code health',
  },
  {
    number: 377,
    conventionalMessage: 'refactor: extract SystemLogsSection component',
  },
  {
    number: 376,
    conventionalMessage: 'refactor: extract DemoSeederSection from UserAccountsSection',
  },
  {
    number: 375,
    conventionalMessage: 'refactor: simplify ClaimWishForm by extracting logic to a custom hook',
  },
  {
    number: 374,
    conventionalMessage:
      'fix: improve regex to prevent false positive key matching in samconfig deploy',
  },
  {
    number: 373,
    conventionalMessage: 'refactor: simplify RawWebSocketWrapper to improve readability',
  },
  {
    number: 372,
    conventionalMessage: 'refactor(AccountPage): simplify UnauthenticatedAccountView component',
  },
  {
    number: 371,
    conventionalMessage: 'refactor: simplify WishCard by extracting action components',
  },
  {
    number: 370,
    conventionalMessage: 'refactor: refactor LocalMetricsDashboard',
  },
  {
    number: 369,
    conventionalMessage: 'fix: prevent command injection in kiosk remote cleanup',
  },
  {
    number: 367,
    conventionalMessage: 'test: remove resolved issue comment from WiFiQrCode test',
  },
  {
    number: 366,
    conventionalMessage: 'fix: n+1 query issue during legacy SQLite migration',
  },
  {
    number: 365,
    conventionalMessage: 'refactor: simplify and improve code readability in AuthProvider',
  },
  {
    number: 364,
    conventionalMessage:
      'refactor: simplify AttributeInput component by extracting getDynamicPillIcon',
  },
  {
    number: 363,
    conventionalMessage: 'refactor: simplify setupCamera function in WishScanner',
  },
  {
    number: 362,
    conventionalMessage: 'refactor: simplify renderOverlay in WishScanner',
  },
  {
    number: 361,
    conventionalMessage: 'fix: sql injection vulnerability in wishes filters using json_each',
  },
  {
    number: 360,
    conventionalMessage: 'test: add missing tests for fallbackTextContour in cardProcessor.ts',
  },
  {
    number: 358,
    conventionalMessage: 'refactor: simplify AwsMetricsDashboard component',
  },
  {
    number: 357,
    conventionalMessage: 'refactor: simplify overly long applyExclusionFilter function',
  },
  {
    number: 356,
    conventionalMessage: 'fix: unsafe Regular Expression Construction in serverless CLI commands',
  },
  {
    number: 355,
    conventionalMessage: 'fix: unsafe Regular Expression Construction in serverless.js',
  },
];

async function updatePRs() {
  console.log('Applying overrides to PRs...');
  for (const ov of overrides) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/plthomasva/wishboard/pulls/${ov.number}`,
        {
          headers: {
            Authorization: `token ${process.env.GH_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch PR: ${response.statusText}`);
      }

      const pr = await response.json();

      if (pr.body && pr.body.includes('BEGIN_COMMIT_OVERRIDE')) {
        console.log(`PR ${ov.number} already has an override block. Skipping.`);
        continue;
      }

      const newBody = `${pr.body || ''}\n\nBEGIN_COMMIT_OVERRIDE\n${ov.conventionalMessage}\nEND_COMMIT_OVERRIDE\n`;

      const patchResponse = await fetch(
        `https://api.github.com/repos/plthomasva/wishboard/pulls/${ov.number}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `token ${process.env.GH_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: newBody }),
        }
      );

      if (!patchResponse.ok) {
        throw new Error(`Failed to update PR: ${patchResponse.statusText}`);
      }

      console.log(`Successfully updated PR ${ov.number}`);
    } catch (e) {
      console.error(`Error updating PR ${ov.number}: ${e.message}`);
    }
  }
}

updatePRs();
