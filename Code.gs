/**
* from jackcarey.co.uk
*/

/**
 * Run on a daily schedule
 */
function transformTransactions() {
  // Transaction ID,	Date,	Time,	Type,	Name,	Emoji,	Category,	Amount, Currency,	Local amount,	Local currency,	Notes and #tags,	Address,	Receipt,	Description,	Category split
  const allData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Personal Account Transactions").getDataRange().getValues();
  const newData = [];
  const now = new Date();
  // tx older than this are summarized into buckets by monthy, account, and category
  const oldCutoff = new Date(now)
  oldCutoff.setFullYear(now.getFullYear() - 1);
  oldCutoff.setDate(1);
  oldCutoff.setHours(0);
  oldCutoff.setMinutes(0);
  oldCutoff.setSeconds(0);
  oldCutoff.setMilliseconds(0);

  console.log(`transactions before ${oldCutoff.toISOString()} will be summarised`);
  for (let idx = 0; idx < allData.length; ++idx) {
    const row = allData[idx];
    if (idx == 0) {
      newData.push([...row, "Account"]);
      continue;
    }
    const type = row[3];
    const categorySplit = row[15];
    if (!row[16]) {
      row.push("Monzo");
    }

    const rowsToPush = [];

    //this section turns category splits into separate transactions with apportioned amounts
    if (!categorySplit?.length) {
      rowsToPush.push(row);
    } else {
      const categoriesWithAmounts = categorySplit.split(",").map(catAmount => catAmount.split(":"));
      const splitRows = categoriesWithAmounts.map(([cat, amount]) => {
        const newRow = [...row];
        newRow[6] = cat;
        newRow[7] = amount;
        //remove the category split
        newRow[15] = "";
        return newRow;
      });
      // console.log("category split for", row[0], categorySplit);
      splitRows.forEach(r => rowsToPush.push(r));
    }

    // this section adds the other half of pot transactions so the pot balance is actually tracked, rather than just the Monzo outgoings
    for (let j = 0; j < rowsToPush.length; ++j) {
      const rowToPush = rowsToPush[j];
      //if the transaction is old enough that it'll just be summarised anyway, don't bother splitting it
      if (rowToPush[1] && rowToPush[1] < oldCutoff) {
        continue;
      }
      const type = rowToPush[3];
      // if the account is not monzo, this pot tx has already been mirrored, so it can be ignored
      if (type == "Pot transfer" && rowToPush[16] == "Monzo") {
        // console.log("mirroring pot transfer...", rowToPush[0]);
        const potMirror = [...rowToPush];
        // this will also stop this tx being checked again
        potMirror[16] = "Monzo " + potMirror[4];
        //flip the amounts
        potMirror[7] = 0 - potMirror[7];
        potMirror[9] = 0 - potMirror[9];
        //add to sub array
        rowsToPush.push(potMirror);
      }
    }

    // if the row has not been transformed then it can be filtered as-is.
    if (rowsToPush.length === 0) {
      rowsToPush.push(row);
    }

    //if the transactions are old then they can be added to summary rows instead to reduce the amount of data imported downstream
    for (let k = 0; k < rowsToPush.length; ++k) {
      const row = rowsToPush[k];
      if (row[1] && row[1] < oldCutoff) {
        const year = row[1].getFullYear();
        const month = row[1].getMonth();
        const category = row[6];
        const account = row[16];
        const amount = row[7];
        const type = 'summary row';
        const description = `Summary for category ${category} in account ${account} on month ${year}-${month + 1}`;

        const existingSummaryIdx = newData.findIndex((val) =>
          new Date(val[1]).getFullYear() === year
          && new Date(val[1]).getMonth() === month
          && val[6] === category
          && val[16] === account
          && val[3] === type
        );

        if (existingSummaryIdx === -1) {
          const newSummaryRow = [0, new Date(year, month, 28), 0, type, '', '📊', category, amount, row[8], amount, row[8], '#summary', '', '', description, '', account];
          // console.log(`creating new summary row: ${description}`, newSummaryRow);
          newData.push(newSummaryRow);
        } else {
          const existingSummaryRow = Array.from(newData[existingSummaryIdx]);
          const preAmount = existingSummaryRow.slice(0, 7);
          const newAmount = existingSummaryRow[7] + amount;
          const currency = existingSummaryRow[8];
          const postAmount = existingSummaryRow.slice(-6);
          const updatedSummaryRow = [...preAmount, newAmount, currency, newAmount, currency, ...postAmount];
          // console.log(newData[existingSummaryIdx], updatedSummaryRow);
          newData[existingSummaryIdx] = updatedSummaryRow;
        }
      } else {
        newData.push(row);
      }
    }
  }
  // keep only interesting columns from:
  // 0 Transaction ID, 1 Date,	2 Time,	3 Type,	4 Name,	5 Emoji,	6 Category,	7 Amount, 8 Currency,	9 Local amount,	10 Local currency,	11 Notes and #tags, 12	Address,	13 Receipt,	14 Description,	15 Category split, 16 Account
  // this could be more efficient by including it in a previous loop but for now idgaf
  const slimData = newData.map((row, idx) => {
    const dateStr = row[1].toString();
    const timeStr = row[2].toString();
    const dateDt = new Date(Date.parse(dateStr));
    const timeDt = new Date(Date.parse(timeStr));
    dateDt.setHours(timeDt.getHours());
    dateDt.setMinutes(timeDt.getMinutes());
    dateDt.setSeconds(timeDt.getSeconds());
    const dt = idx == 0 ? "Datetime" : dateDt;
    const type = row[3];
    const category = row[6];
    const amount = row[7];
    const name = row[4];
    const notes = row[11];
    const desc = row[14];
    const account = row[16];
    const fullDesc = Array.from(new Set([name, notes, desc, type])).filter(x => x.length).join(" | ").replace(/\s+/gmi, " ").trim();
    const mergedDesc = idx == 0 ? "Description" : fullDesc;
    return [dt, account, category, amount, mergedDesc];
  }).filter(row => row[3] !== 0); //if a summary row or tx has no net change, I don't care about it. This is most likely from transfers or active card checks
  const transformedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transformed");
  transformedSheet.clear();
  transformedSheet.getRange(1, 1, slimData.length, slimData[0].length).setValues(slimData);
}

function onOpen(e) {
  SpreadsheetApp.getUi().createMenu("Scripts").addItem("Transform Tx", "transformTransactions").addToUi();
  transformTransactions();
}

function onEdit(e) {
  if (e.range.getSheet().getName() !== "Personal Account Transactions") {
    return;
  }
  transformTransactions();
}
