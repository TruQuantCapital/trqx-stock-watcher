# TRQX AI Market Terminal v21 — Production Polish

## Included

- Final ticker strip:
  - SPY
  - QQQ
  - DIA
  - IWM
  - VIX
  - Market Open / Market Closed

- Proper market status logic:
  - Monday-Friday
  - 9:30 AM ET to 4:00 PM ET
  - Shows live ET time

- Product cards standardized:
  - Same height
  - Same hover glow
  - Real image tags
  - No developer notes

- Luxury background typography:
  - INTELLIGENCE
  - PRECISION
  - DISCIPLINE
  - EXECUTION
  - PROBABILITY

- Options Flow section updated:
  - Added Subscribe Here button
  - Link points to Whop

## Links

- Whop:
  https://whop.com/tqpx-tru-quant-enterprise

- Discord:
  https://discord.gg/jy3ta9qkfH

## Upload

Upload all files/folders to GitHub root, redeploy Vercel production, then hard refresh:

Ctrl + Shift + R


## v21.1 Update

- Added **Subscribe to ORB** button in the Options Flow section.
- Button points to:
  https://whop.com/joined/tqpx-tru-quant-enterprise/products/tlqx-precision-orb/
- Kept the existing Learn More button.
- Updated ORB product card link to the same Whop product URL.


## v21.1 Update

- Added **Subscribe to ORB** button to the Options Flow preview card.
- Button points to:
  https://whop.com/joined/tqpx-tru-quant-enterprise/products/tlqx-precision-orb/
- Kept the existing Learn More button.
- Updated ORB product card link to the same Whop product URL.


## v21.2 Update

- VIX now uses VIXY as the data source while displaying the label as VIX. This avoids blank VIX values when the quote API does not support `^VIX`.
- Added TRQX Membership Onboarding section:
  - Subscribe on Whop
  - Accept Disclaimer
  - Member Intake
  - Join Discord
- Added disclaimer modal.
- Added customer intake modal.
- Intake currently saves to browser localStorage. Next recommended step is connecting this to Whop webhooks, Airtable, Google Forms, or a CRM.
