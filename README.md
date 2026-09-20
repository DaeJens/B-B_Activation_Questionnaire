# reHome, Improved: Booth Quiz

A three-question iPad quiz for the *reHome, Improved* Home Depot wall activation. Guests answer three questions, get matched to a project and a gift, and the prize inventory is tracked live in a Google Sheet. When a prize runs out, the quiz automatically matches guests to their next-best prize.

## How it works

```
iPad (Safari, Guided Access)  ──POST──▶  Google Apps Script web app  ──▶  Google Sheet
   index.html                       Code.gs                        Inventory / Log / Settings
```

- **`index.html`** is the guest-facing page. It scores the answers into a ranked list of prizes and sends that list to the script.
- **`Code.gs`** runs in Google Apps Script, attached to the Sheet. It walks the ranked list, awards the first prize still in stock, updates the counts, and writes a log row. It processes one claim at a time, so two iPads can never hand out the same last prize.
- **The Google Sheet** is the source of truth for inventory. Edit quotas there at any time.

## Prizes and scoring

| Mostly | Project | Gift | Card | Sheet ID |
|---|---|---|---|---|
| A | Painted ceiling | Paintbrush | 1 | `ceiling` |
| B | Picture frame moulding | Work gloves | 2 | `moulding` |
| C | Painted wallpaper | Mini paint kit and stencil | 3 | `wallpaper` |
| D | Hang artwork | Picture-hanging kit | 4 | `artwork` |
| Bonus | $100 The Home Depot gift card | Gift card | 5 | `bonus` |

- Each answer scores one point for its letter. The most common letter wins.
- Ties go to the answer to question 2, then question 1, then question 3.
- If the top prize is out of stock, the guest gets their next-ranked prize.
- The $100 gift card is a random bonus on top of a regular prize. The odds are set by `Bonus chance` on the Settings tab (0 pauses it, 1 gives it to everyone).
- If all four regular prizes are gone, guests see a "Thanks for playing" screen.

## Repository contents

| File | Purpose |
|---|---|
| `index.html` | The quiz page (single file, no build step) |
| `assets/logo.png` | Home, Improved logo (transparent background) |
| `assets/pattern.jpg` | Tool pattern shown on the start screen |
| `assets/fonts/` | Bundled fonts (Open Sans, Libre Baskerville Medium) so the iPads don't need the internet for type |
| `README.md` | This file |
| `.env` | Holds the shared token. **Never committed** (see `.gitignore`) |
| `.gitignore` | Keeps `.env` out of the repository |

The Apps Script code lives in the Google Sheet under **Extensions → Apps Script**.

## Configuration

Two values must match between the page and the script:

| Value | In `index.html` | In Apps Script (`Code.gs`) |
|---|---|---|
| Token | `const TOKEN = "..."` | `const TOKEN = '...'` |
| Web app URL | `const SCRIPT_URL = "..."` | (generated when you deploy) |

The token's value is stored in `.env` for reference. The page is plain static HTML and cannot read `.env` on its own, so the token is copied into `index.html` by hand.

Other settings at the top of the script block in `index.html`:

- `RESULT_SECONDS`: how long a result stays on screen before resetting (default 30)
- `IDLE_SECONDS`: how long a question screen waits with no touch before resetting (default 45)

## Setup

### 1. Google Sheet and script

1. Create a Google Sheet, then open **Extensions → Apps Script** and paste in `Code.gs`. Set `TOKEN`.
2. Save, choose `setup` in the function dropdown, and click **Run**. Approve the permissions when asked. This creates the **Inventory**, **Log** and **Settings** tabs.
3. On the Inventory tab, set each prize's **Quota** to your real count.
4. Choose **Deploy → New deployment → Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone**, then copy the web app URL.

After any later edit to `Code.gs`, redeploy with **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The URL stays the same.

### 2. The page

Paste the web app URL into `SCRIPT_URL` and the token into `TOKEN` in `index.html`. With `SCRIPT_URL` left empty, the page runs in demo mode with counts kept only on that device.

### 3. Hosting

Host the page over HTTPS (for example GitHub Pages). On GitHub Pages the page is served at `https://<user>.github.io/<repo>/`. 

### 4. iPads

1. Open the page with a device name, for example `.../index.html?device=iPad1` (and `?device=iPad2` on the second iPad). The name appears in the Log tab.
2. Tap **Share → Add to Home Screen**, then open it from the home screen icon.
3. Triple-click the side or home button to start **Guided Access** so guests can't leave the page.

## Event-day checklist

- [ ] Quotas on the Inventory tab match the physical stock
- [ ] `Bonus chance` on the Settings tab is set as intended
- [ ] Test rows deleted from the Log tab and every **Awarded** cell reset to 0
- [ ] Both iPads charged, on the booth Wi-Fi, and in Guided Access
- [ ] Cards 1 to 5 and gifts stocked at the booth

During the event, watch the **Remaining** column on the Inventory tab. Opening the web app URL in a browser also shows live counts as JSON.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "We couldn't finish your match" on every attempt | Token in the page and the script don't match, or the latest script edit wasn't redeployed |
| Google sign-in page instead of JSON at the web app URL | Deployment access isn't set to **Anyone** |
| Yellow "Demo mode" badge shows | `SCRIPT_URL` is empty in the page |
| First guest of the day is slow | The script was asleep. The page pings it every 4 minutes to keep it warm |
| A guest sees the error screen but a prize was logged | Tapping **Try again** reuses the same request, so the guest gets that same result and it is never counted twice |

## Security note

The token is light protection only. Anyone who opens the page's source can see it, and it is visible in the repository if the page is committed with it filled in. Use a value you don't use anywhere else, and rotate it (change it in both places and redeploy) after the event.