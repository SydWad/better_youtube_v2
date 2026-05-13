# Better Youtube

A Chrome/Brave browser extension that gives you full control over your YouTube browsing experience. Filter content by type, length, or keyword, and maintain a permanent portable watch history that YouTube cannot reset.

## Features

- Filter YouTube by page (Home, Subs, Sidebars, Channels, Search) — ON / OFF / ADVANCED per page:
- Hide Shorts
- Hide Members-Only videos
- Hide Live Streams
- Hide Auto-Dubbed videos
- Hide Playlists
- Hide Upcoming / Scheduled videos
- Hide partially-watched videos (progress bar threshold)
- Hide by minimum view count
- Hide by video length range
- Word blacklist (hide by title/channel keyword)
- Permanent local watch history (auto-saves watched videos)
- "Not Interested" click saves to watch history
- Retrieve full YouTube history (auto-scroll + scrape)
- Export watch history to .txt
- Import watch history from .txt
- Per-page advanced filter settings (all filters independently configurable per page)
- Copy filter settings from one page to another
- Extension enable/disable toggle
- Dark / Light theme support

## Installation

1. Download or clone this repository to your computer.
2. Open a new tab in Firefox and navigate to about:debugging.
3. Click on This Firefox in the left-hand sidebar.
4. Click the Load Temporary Add-on... button.
5. Open your extension folder and select the manifest.json file (or any file within the directory).
6. Navigate to YouTube — the extension is active immediately.

## Usage

Click the extension icon to open the popup panel. All filtering options are available there. Right-click the icon and select **Options** for advanced settings including watch history management, word blacklist, and import/export.

## Data & Privacy

All data is stored locally on your device using `chrome.storage.local`. No data is ever transmitted to any server. No analytics, telemetry, or tracking of any kind is present. See [PRIVACY.md](PRIVACY.md) for full details.

## License

MIT — see [LICENSE](https://opensource.org/license/mit)

## Disclaimer

This extension is not affiliated with, endorsed by, or connected to YouTube or Google LLC in any way. YouTube is a trademark of Google LLC.
