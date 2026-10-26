# Mary Lisa & Edison: wedding website

Wedding details and RSVP site for August 9, 2027 at Stonefields Estate, Carleton Place, Ontario.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The whole website |
| `img/` | Florals, paper texture and the hero photo |
| `google-sheets-rsvp.gs` | The script that saves RSVPs into your Google Sheet. It is not used by the website itself; it's kept here as a backup copy. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## 1. Set up the Google Sheet for RSVPs

1. Go to sheets.google.com and create a blank spreadsheet. Name it something like **Wedding RSVPs**.
2. In the sheet, open **Extensions > Apps Script**.
3. Delete the sample code, paste in everything from `google-sheets-rsvp.gs`, and click **Save**.
4. In the function menu at the top, choose **setup** and click **Run**. Google will ask you to allow access to your sheet. Approve it. (It may warn that the app isn't verified, because you wrote it yourself. Click **Advanced**, then **Go to project**.)
5. Back in the sheet you'll now have two tabs: **Guest List** and **RSVPs**.
6. In Apps Script, click **Deploy > New deployment**. Choose the type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
7. Copy the **Web app URL** (it ends in `/exec`) and send it to Claude. It gets added to the website so replies land in your sheet.

### The Guest List tab

- Column A: each guest's full name, the way you know them.
- Column B: `Yes` if they may bring a plus-one, `No` (or blank) if not, or the plus-one's name if you already know it.
- If this tab has names in it, only those guests can RSVP. If it's empty, anyone with the link can.
- Names are only checked by the script. They never appear in the website's code.

### Personal RSVP links

1. Add your guests to the **Guest List** tab: name in column A, and in column B either `Yes`/`No` for a plus-one or the plus-one's name (it's then filled in on that guest's form).
2. Reload the sheet. A **Wedding RSVPs** menu appears at the top. Choose **Make personal links**.
3. Each guest gets a private code in column D and their own link in column E. Copy a guest's link into your email or message to them.
4. Added more guests later? Run **Make personal links** again. Existing links never change.

When a guest opens their link, the RSVP form already shows their name, and shows their last reply if they sent one. A reply sent from a personal link can only be changed from that same link. Guests without their link can still type their name, but that can't overwrite a reply made from a link. The **Sent from** column on the RSVPs tab shows which way each reply came in.

### If you change the script later

Use **Deploy > Manage deployments**, edit the existing deployment and choose **New version**. That keeps the same URL so the website doesn't need updating.

## 2. Put the site on GitHub Pages

1. Create a new repository on github.com, for example `wedding`.
2. Upload everything in this folder, including the `img` folder and `.nojekyll`.
3. In the repository, go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute or two the site will be live at `https://<your-username>.github.io/wedding/`.

A custom domain can be added later under the same **Settings > Pages** screen.

Note: on a free GitHub account the repository has to be public for Pages to work. That's fine for this site, since the guest list stays in Google Sheets.
