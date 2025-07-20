# monzo-transform-sheet

This script initially used [Monzo's API](https://developers.monzo.com/) to import raw data to a Google Sheet, but now they have an [integration](https://monzo.com/help/monzo-premium/advanced-budgeting-auto-exports) you can use instead. Once you've got your transactions in a Google Sheet tab called `Personal Account Transactions` and the same format as the integration or CSV export, you can copy this code into [Apps Script](https://developers.google.com/apps-script/guides/sheets). It will create/update a sheet called `Transformed` to do the following:

- Separate category splits into individual rows with the correct amounts.
- Add the other half of Pot transfers, as if they are a separate account prefixed with `Monzo`.
- Summarise all transactions older than 1 year into monthly rows by category.
- Consolidate descriptive information into 1 cell. This includes the vendor name, notes & tags, description, and tx type.

**Of note:** 

- Monzo's integration does *not* include transactions straight from Pots or interest payments on Pots, and this script does *not* do anything about that. You're already using Google Sheets if you're looking at this, so you can add a downstream ledger tab for this reconciliation, tracking future transactions, adding transactions from other bank accounts, or anything else you want to do there.
- The script can take time to run against a lot of transactions, and this will only increase the more you use your account. Set up a [time-based trigger](https://developers.google.com/apps-script/guides/triggers/installable#time-driven_triggers) to run in line with how often you check your finances or [onOpen](https://developers.google.com/apps-script/guides/triggers) with the document.
