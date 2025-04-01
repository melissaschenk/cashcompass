const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const app = express();
const port = 3000;
const path = require('path');
const auth = require('./auth'); 
const { start } = require('repl');


app.set('views', './views'); // Set the views directory if not in the root


// app.get('/login', (req, res) => {
//   res.sendFile(path.join(__dirname, 'views', 'login.html'));
// });

// app.get('/register', (req, res) => {
//   res.sendFile(path.join(__dirname, 'views', 'register.html'));
// });

app.get('/dashboard', (req, res) => {
    res.render('dashboard'); // Render the 'about.ejs' view
});




app.post('/register', async (req, res) => {
  console.log(req)
  console.log(res)
  //const { username, password } = req.body;
  // if (!username || !password)
  //     {
  //         res.status(400).send('Missing username or password');
  //          return;
  //     }
 try {
      //await auth.registerUser(username, password)
       res.redirect('/');
  } catch(err){
        res.status(500).send('Error registering user')
  }

});

app.post('/login', async (req, res) => {
  // const { username, password } = req.body;
  //    if (!username || !password)
  //     {
  //         res.status(400).send('Missing username or password');
  //          return;
  //     }

  if (await auth.authenticateUser(username, password)) {
      res.send('Login successful!');
  } else {
      res.status(401).send('Login failed. Invalid username or password.');
     // res.sendFile(path.join(__dirname, 'views', 'login.html'), {error: 'invalid credentials'})
     // res.redirect('/?error=invalid');
  }
});


app.set('view engine', 'ejs');
app.use(express.static('public'));


let data_files = {'checking': ['data_checking.csv']
  ,'savings':['data_savings.csv']
  ,'spending':['m_spending.csv','wmonroechecking.csv']
  ,'cleanup_category':['cleanup_category.csv']
  ,'target':['data_target.json']
  ,'spender_labels':['data_spender_labels.json']


}

// data_files = {'checking': ['s_checking.csv']
//   ,'savings':['s_savings.csv']
//   ,'spending':['a_spending.csv','m_spending.csv']
//   ,'cleanup_category':['cleanup_category.csv']
//   ,'target':['s_target.json']
//   ,'spender_labels':['spender_labels.json']
// }



function processDates(inputDictionary) {
  const monthYearMap = {}; // Store unique month/year with first day
  const processedDates = []; // Array to store the dates in YYYYMMdd format

  for (const key in inputDictionary) {
    if (inputDictionary.hasOwnProperty(key)) {
      const dateStr = inputDictionary[key].TransactionDate;

      // Convert to Date object
      const date = new Date(dateStr);
      if (isNaN(date)) {
         console.error(`Invalid date string: ${dateStr}`)
         continue; // skip to next entry
      }
      const year = date.getFullYear();
      const monthName = getMonthName(date.getMonth());
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed

      const monthYearKey = `${monthName} ${year}`;

      if (!monthYearMap[monthYearKey]) {
           // Create date for first of month
        const firstDayOfMonth = new Date(year, date.getMonth(), 1); 
        const firstDayYYYYMMDD = `${year}${month}01`
        monthYearMap[monthYearKey] = firstDayYYYYMMDD;
        processedDates.push(firstDayYYYYMMDD); // for sorting

       }
    }
  }

  // Sort the processedDates in descending order
  //processedDates.sort((a, b) => b.localeCompare(a));


   // create dictionary to return, with Month Year as key and value from sorted list
   const result = {};
   for (const monthYearKey in monthYearMap) {
       if (monthYearMap.hasOwnProperty(monthYearKey)) {
            for (const formattedDate of processedDates) {
              const datePart = formattedDate.substring(0,6);
              const keyPart = formatDateToYYYYMM(new Date(monthYearKey))//monthYearKey.substring(0,2)+monthYearKey.substring(3,7);
              if (datePart == keyPart){
                result[monthYearKey] = formattedDate;
              }
              
           }
      }
   }
  
  return sortDictionaryByValueDesc(result);
}

function getMonthName(monthNumber, locale = 'default') {
  const date = new Date(2000, monthNumber); // Year is irrelevant
  return date.toLocaleString(locale, { month: 'long' });
}

function formatDateToYYYYMM(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 because months are 0-indexed

  return `${year}${month}`;
}

function sortDictionaryByValueDesc(inputDictionary) {
  // 1. Convert the dictionary to an array of [key, value] pairs.
  const entries = Object.entries(inputDictionary);

  // 2. Sort the array by value (in YYYYMMDD format), descending.
  entries.sort(([, valueA], [, valueB]) => {
      return valueB.localeCompare(valueA);
  });

  // 3. Convert the sorted array back into a dictionary (object)
  const sortedDictionary = {};
  for (const [key, value] of entries) {
      sortedDictionary[key] = value;
  }

  return sortedDictionary;
}


// const inputFile = 'data/'+data_files.spending[1];
// const outputFile = 'output.csv';

// const inputCsvPath = 'data/'+data_files.spending[1]; // Path to input CSV
// const outputCsvPath = 'output.csv'; // Path to output CSV

// const spender1_csvfile = fs.readFileSync(inputCsvPath, {encoding:'utf8'});

// const results = [];
// console.log(spender1_csvfile)



// function modifyCsvHeadersSync() {
//   try {
//       const fileContent = fs.readFileSync(inputCsvPath, 'utf-8');
//       const results = [];
//       const rows = fileContent.trim().split('\n');
//       if (rows.length <= 0){
//         console.log("Input file is empty, exiting...")
//         return;
//       }
//       const headers = rows[0].split(',').map(header => header.trim());

//       for (let i = 1; i < rows.length; i++){
//           const data = rows[i].split(',').map(data => data.trim())
//           const row = {};
//           for (let j=0; j < headers.length; j++) {
//               row[headers[j]] = data[j];
//           }

//           results.push(row);
//       }

//       const modifiedHeaders = headers.map(header =>
//           header.replace(/\s+/g, '')
//       );
//       const csvWriter = createObjectCsvWriter({
//           path: outputCsvPath,
//           header: modifiedHeaders.map(header => ({id: header, title: header})),
//       });

//       csvWriter.writeRecords(results).then(() => {
//           console.log(`Successfully modified column headers and wrote to ${outputCsvPath}`);
//       });
//   } catch (error) {
//       console.error('Error:', error);
//   }
// }

// modifyCsvHeadersSync(outputCsvPath);

// console.log()







// async function modifyCsvHeaders(spender_csvfile) {
//   try {
//     const results = [];
//     console.log(spender_csvfile)

//     // Read CSV file
//     const csvStream = fs.createReadStream(inputCsvPath)
//           .pipe(csv())
//           .on('data', (row) => results.push(row));

//     await new Promise((resolve, reject) => {
//       csvStream.on('end', resolve)
//           .on('error', reject);
//     })
//     if(results.length === 0){
//       console.log("Input file is empty, exiting...")
//       return;
//     }
//     const originalHeaders = Object.keys(results[0]);

//     // Modify headers (remove spaces)
//     const modifiedHeaders = originalHeaders.map(header =>
//         header.replace(/\s+/g, '')
//     );


//     // Create CSV writer
//     const csvWriter = createObjectCsvWriter({
//       path: outputCsvPath,
//       header: modifiedHeaders.map(header => ({id: header, title: header})),
//     });

//     // Write to new CSV file
//     await csvWriter.writeRecords(results);

//     console.log(`Successfully modified column headers and wrote to ${outputCsvPath}`);
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }


// modifyCsvHeaders();


// const results = [];

// fs.createReadStream(inputFile)
//   .pipe(csv({
//     skipEmptyLines: true // Skip empty lines
//   }))
//   .on('data', (data) => {
//     // Perform cleanup on columns here (e.g., trim whitespace)
//     for (const key in data) {
//       data[key] = data[key].trim();
//     }

//     results.push(data);
//   })
//   .on('end', () => {
//     const csvWriter = createCsvWriter({
//       path: outputFile,
//       header: Object.keys(results[0]).map(key => ({ id: key, title: key }))
//     });

//     csvWriter
//       .writeRecords(results)
//       .then(() => console.log('CSV file successfully cleaned and written.'));
//   });











const spenderLabelData = require('./data/'+ data_files.spender_labels);

// const spender0Label= spenderLabelData.spender0
// const spender1Label= spenderLabelData.spender1


const targetData = require('./data/'+ data_files.target);

const cleanup_category = fs.readFileSync('data/'+data_files.cleanup_category, {encoding:'utf8'});
const dict_cleanup_category = csvToDict(cleanup_category);

function monthDiff(d1, d2) {
  var months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}
function csvToDict(csvData) {
  let linedelimiter = '\n'
  if (csvData.includes('\r\n')) {
    linedelimiter = '\r\n'
  }

  const lines = csvData.split(linedelimiter);
  const headers = lines[0].split(',');
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const dictRow = {};

    // const category = row.Category;
    // const amount = parseFloat(row.Amount);
    // const date = row.Date; //Or any other relevant data point.

    for (let j = 0; j < headers.length; j++) {
      dictRow[headers[j]] = row[j];
    }

    result.push(dictRow);
  }

  return result;
}

function processSpendingCategoryData(dict) {
  const numRecords = Object.keys(dict).length;
  const spendingData = {};
  const paymentData = {};
  let category ="";
  let typeValue = "";
  let itemDescription ="";
  //console.log(numRecords)
  let dateValue;

    for (let i = 0; i < Object.keys(dict).length; i++) {
      Object.entries(dict[i]).forEach(([key, value]) => {
      //  console.log("key: " + key)
      //  console.log("value: " + value);
      if (key == 'Category'){
        category = value
      }
      if (key == 'Amount'){
        categoryValue = value

        // if (value > 0) {
        //   category = "Income"
        // }
       

      }
      if (key == 'TransactionDate'){
        dateValue = value
      }
      if (key == 'Type'){
        typeValue = value
      }


    });

    if (typeValue == "" && categoryValue > 0) {
      console.log(dict)
    }

    
    if (typeValue == "Income") {

    };

   
    if (!spendingData[category] && typeValue != "Payment" && category != "Income" && category != "Way2Save") {
      spendingData[category]  = { total: 0, items: [] };
    }
    if (typeValue != "Payment" && category != "Income" && category != "Way2Save") {
      spendingData[category].total += categoryValue*-1;
      spendingData[category].items.push(dict[i]);
    }
  }
  const sortedSpendingData = Object.entries(spendingData).sort(([, a], [, b]) => b.total - a.total);
  return sortedSpendingData;

}

function getStartAndEndDates(filter) {
  const today = new Date();
  let year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  let startDate, endDate;
  let month_number = 0  


  if ((filter.startsWith("20")) && (filter.length == 8))
    {
      month_number = parseInt(filter.substring(4, 6));
      year = parseInt(filter.substring(0, 4));
      startDate = new Date(year,month_number-1,1)
      endDate = new Date(year,month_number, 0);
      filter = "SpecificMonthYear"
    }



  if (filter) {
    if (filter.includes('M_') && filter) {
      month_number = parseInt(filter.replace('M_', ''));
      filter = 'M_'
    }
  }

  switch (filter) {
    case 'SpecificMonthYear': 
      break;
    case 'last30Days': // New case for 30 days
      endDate = new Date(year, month, day);
      startDate = new Date(year, month, day - 30); //Subtracts 30 days
      break;
    case 'lastMonth':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 1, day);
      break;
    case 'last3Months':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 3, day);
      break;
    case 'last6Months':
      endDate = new Date(year, month, day);
      startDate = new Date(year, month - 6, day);
      break;
    case 'ytd':
      endDate = new Date(year, month, day);
      startDate = new Date(year, 0, 1); // January 1st of the current year
      break;
    case 'last12Months':
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      break;
    case 'lastYear':
      endDate = new Date(year, month, day);
      startDate = new Date(year - 1, month, day);
      break;
    case 'last2Years':
      endDate = new Date(year, month, day);
      startDate = new Date(year - 2, month, day);
      break;
    case 'M_':
      if (month_number != 0) {
        endDate = new Date(year - 1, month_number, 0);
        startDate = new Date(year - 1, month_number-1, 1);
        break;
      }

    default:
      throw new Error('Invalid period specified.');
  }



  // Adjust start date if it falls outside the valid range
  if (startDate.getTime() < 0) {
    const diff = startDate.getTime() * -1; //Negative value
    startDate = new Date(0);
    startDate.setTime(diff)
  }

  return { startDate, endDate };
}



let checkingData = [];
let savingsData = [];
let spendingData = {};
let spendingData0 = {};
const spendersData = []
const spendingDict = {}

//SPENDING
// const spending_ds1 = fs.readFileSync('data/'+data_files.spending, {encoding:'utf8'});
// const spending_transactions = csvToDict(spending_ds1);

data_files.spending.forEach(spender => {

  let spending_ds1 = fs.readFileSync('data/'+spender, {encoding:'utf8'});
  let spending_transactions = csvToDict(spending_ds1);

  spending_transactions.forEach(transaction => {
    dict_cleanup_category.forEach(category => {
      if(transaction.Description.includes(category.Description)) {
        transaction.Category = category.Category;
      }
      // console.log(transaction);
      // console.log(category);

    });
    
  });



    for (const row of spending_transactions) {
      const key = Object.values(row)[0]; // first column
      spendingDict[key] = row;
    }
  
  spendersData.push({ spending_transactions: spending_transactions });
});


const getUniqueCategories = (spender) => {
  //spendin
  const categories = spendersData[spender].spending_transactions.map(expense => expense.Category);
  const array_categories = [...new Set(categories)];
  const sorted_categories = array_categories.sort();
  return sorted_categories;
}


//CHECKING DATA

const dict_cschecking_transactions = csvToDict(fs.readFileSync('data/'+data_files.checking, {encoding:'utf8'}));
const sortedCheckingDataAsc = dict_cschecking_transactions.sort((a, b) => {
  return new Date(a.Date) - new Date(b.Date); //sort oldest to newest
});
sortedCheckingDataAsc.forEach(transaction => {
  checkingData.push({ x: transaction.Date, y: parseFloat(transaction.RunningBalance) });
});

let currentCheckingBalance = sortedCheckingDataAsc[sortedCheckingDataAsc.length-1].RunningBalance
console.log(currentCheckingBalance)


//SAVINGS DATA
const dict_pncsavings_transactions = csvToDict(fs.readFileSync('data/'+data_files.savings, {encoding:'utf8'}));

const sortedSavingsDataAsc = dict_pncsavings_transactions.sort((a, b) => {
  return new Date(a.Date) - new Date(b.Date); // Reversed comparison
});

sortedSavingsDataAsc.forEach(transaction => {
  savingsData.push({ x: transaction.Date, y: parseFloat(transaction.Balance) });
});

let currentSavingsBalance = sortedSavingsDataAsc[sortedSavingsDataAsc.length-1].Balance
console.log(currentSavingsBalance)

function formatCurrency(value){
    return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}






//SPENDING BY CATEGORY
function groupTransactionsByMonth(transactions) {
  const monthlyTotals = {}; // The dictionary to store totals by month

  for (const transaction of transactions) {
    const date = new Date(transaction.TransactionDate); // Assuming 'date' is a date string
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });  // 'January 2024' etc.

    if (monthlyTotals[month]) {
      monthlyTotals[month] += parseFloat(transaction.Amount);  // add to existing total
    } else {
      monthlyTotals[month] = parseFloat(transaction.Amount);  // init new month
    }
  }
  return monthlyTotals;
}




let dateFilterDict = {
  "Last 30 days": "last30Days"
  ,"Last 3 Months": "last3Months"
  ,"Last 6 Months": "last6Months"
  ,"YTD": "ytd"
  ,"Last Year": "lastYear"
  ,"Last 2 Years": "last2Years"
};

const monthYearFilterDict = processDates(spendersData[1].spending_transactions);
Object.entries(monthYearFilterDict).forEach(([key, value]) => {
  dateFilterDict[key] = value;
});

//console.log(dateFilterDict);

function calculateAverageSpending(category,filter,spender) {
  const dates = getStartAndEndDates(filter);
  const startDate = new Date(dates.startDate);
  const endDate = new Date(dates.endDate);

  let months = parseInt(monthDiff(startDate,endDate));

  const filteredSpendingCategory = spendersData[spender].spending_transactions.filter(transaction => transaction.Category === category);
  const filteredSpending = filteredSpendingCategory.filter(transaction => {
    return new Date(transaction.TransactionDate) >= startDate && new Date(transaction.TransactionDate) <= endDate;
  });

  if (filteredSpending.length === 0) {
    return {averageSpending: 0, message: "No expenses found for this category in the last 12 months"}
  }
  const totalSpending = filteredSpending.reduce((sum, transaction) => sum + parseFloat(transaction.Amount)*-1, 0);
  const averageSpending = totalSpending / months;

  return {averageSpending: averageSpending.toFixed(2),totalSpending:totalSpending, category: category, message: "Success"};
}


app.get('/', (req, res) => {
  // Wait for data to be processed before rendering the page.  This is a simplified approach.  For production, consider promises or async/await.
  setTimeout(() => {
    res.render('index', {
      checkingData: JSON.stringify(checkingData),
      savingsData: JSON.stringify(savingsData),
      spendingData: JSON.stringify(spendingData),
      dateFilterDict: JSON.stringify(dateFilterDict), 
      spenderLabelData: JSON.stringify(spenderLabelData), 
    });
  }, 500); //Added a small delay to ensure data is processed.  Adjust as needed.
});

// API: Get all unique categories
app.get('/api/categories/:spender', (req, res) => {
  const spender = req.params.spender;
  res.json(getUniqueCategories(spender));
});

// API: Get average spending by category
app.get('/api/average-spending/:category/:spender', (req, res) => {
  const category = req.params.category;
  const spender = req.params.spender;
  const averages = calculateAverageSpending(category,'lastYear',spender);
  res.json(averages);
});

// API: Get expenses by category
app.get('/api/expenses/:category/:spender', (req, res) => {
  const category = req.params.category;
  const spender = req.params.spender;
  
  dateFilterData= getStartAndEndDates('last12Months');
    const filteredSpendingCategory = spendersData[spender].spending_transactions.filter(transaction => transaction.Category === category);
  const filteredSpending = filteredSpendingCategory.filter(transaction => {
    return new Date(transaction.TransactionDate) >= dateFilterData.startDate && new Date(transaction.TransactionDate) <= dateFilterData.endDate;
  });
  const filteredSpendingbyMonth = groupTransactionsByMonth(filteredSpending)

  res.json(filteredSpendingbyMonth);
});


app.get('/api/datefilter', async (req, res) => {
  try {
    const { filter } = req.query;
    let dateFilterData = getStartAndEndDates(filter)

    dateFilterData.startDate = formatDate(dateFilterData.startDate)
    dateFilterData.endDate = formatDate(dateFilterData.endDate)

    res.json(dateFilterData);
  }
 catch (error) {
    console.error('Error fetching date filter:', error);
    res.status(500).json({ error: 'Failed to fetch date filter' });
  }
});

app.get('/api/kpis', async (req, res) => {
  const { filter } = req.query;
  //const { spender } = req.query;
  //console.log(spender)
  const { startDate, endDate } = getStartAndEndDates(filter)// { startDate:"11-01-2024",endDate:"11-30-2024" }
  try {
    // Input validation (crucial for security and robustness)
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    let months = parseInt(monthDiff(startDate,endDate));
    if (months == 0) { months = months+1 }
    const colorGreen = '#267326';
    const colorRed = '#c10b14';

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate) || isNaN(parsedEndDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.'});
    }

    const filteredSpendings0 = spendersData[0].spending_transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });
    const filteredSpendings1 = spendersData[1].spending_transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });

    //SPENDING KPIS
    spendingData = processSpendingCategoryData(filteredSpendings1)
    spendingData0 = processSpendingCategoryData(filteredSpendings0)


    let totalSpendingA = 0
    spendingData0.forEach(transaction => {
      totalSpendingA += transaction[1].total
    });

    let totalSpendingM = 0
    spendingData.forEach(transaction => {
      totalSpendingM += transaction[1].total
    });

    let spendingTargetM = targetData.spender1*months;
    let spendingDeltaM = totalSpendingM - spendingTargetM;
    let spendingDeltaLabelM = '';
    let spendingColorM = colorGreen
    if (spendingDeltaM <= 0) {
      spendingDeltaLabelM = 'Under Budget: '
    } else {
      spendingDeltaLabelM = 'Over Budget: '
      spendingColorM = colorRed
    }

    let spendingTargetA = targetData.spender2*months;
    let spendingDeltaA = totalSpendingA - spendingTargetA;
    let spendingDeltaLabelA = '';
    let spendingColorA = colorGreen
    if (parseFloat(spendingDeltaA) <= 0) {
      spendingDeltaLabelA = 'Under Budget: '
    } else {
      spendingDeltaLabelA = 'Over Budget: '
      spendingColorA = colorRed
    }

    let totalSpendingAllTarget = (targetData.spender2+targetData.spender1)*months
    let totalSpendingAllDelta = (parseFloat(totalSpendingA)+parseFloat(totalSpendingM)) - parseFloat(totalSpendingAllTarget)
    let totalSpendingAllDeltaLabel = '';
    let totalSpendingAllColor = colorGreen
    if (parseFloat(totalSpendingAllDelta) <= 0) {
      //good
      totalSpendingAllDeltaLabel = 'Under Budget: '
    } else {
      //bad
      totalSpendingAllDeltaLabel = 'Over Budget: '
      totalSpendingAllColor = colorRed
    }

    //CHECKING KPIS
    let checkingTarget = targetData.checking;
    let checkingDelta = currentCheckingBalance - checkingTarget;
    let checkingDeltaLabel = '';
    let checkingColor = colorGreen
    if (parseFloat(checkingDelta) >= 0) {
      //good
      checkingDeltaLabel = 'Over Target Min Balance: '
    } else {
      //bad
      checkingDeltaLabel = 'Under Target Min Balance: '
      checkingColor = colorRed
    }

    //SAVINGS KPIS
    const filteredSavings = dict_pncsavings_transactions.filter(transaction => {
      return new Date(transaction.Date) >= parsedStartDate && new Date(transaction.Date) <= parsedEndDate;
    });

    //console.log(filteredSavings)
    let totalSavings = 0
    filteredSavings.forEach(transaction => {
      totalSavings += parseFloat(transaction.Deposits)
    });

    //console.log(totalSavings)

    let savingsTarget = targetData.savings*months;
    let savingsDelta = totalSavings - savingsTarget;

    let savingsDeltaLabel = '';
    let savingsColor = colorGreen
    if (savingsDelta <= 0) {
      savingsDeltaLabel = 'Under Goal: '
      savingsColor = colorRed
    } else {
      savingsDeltaLabel = 'Over Goal: '
    }
    

    let kpis = [
      { name: spenderLabelData.spender1 + ' Spending', value: formatCurrency(totalSpendingM), target: formatCurrency(spendingTargetM), targetLabel:'Target', deltaLabel: spendingDeltaLabelM,delta: formatCurrency(spendingDeltaM),deltaLabelColor:spendingColorM },
      { name: spenderLabelData.spender0 + ' Spending', value: formatCurrency(totalSpendingA), target: formatCurrency(spendingTargetA), targetLabel:'Target', deltaLabel: spendingDeltaLabelA, delta: formatCurrency(spendingDeltaA), deltaLabelColor:spendingColorA},
      { name: 'All Spending', value: formatCurrency(totalSpendingA+totalSpendingM), target: formatCurrency(totalSpendingAllTarget), targetLabel:'Target', deltaLabel: totalSpendingAllDeltaLabel, delta: formatCurrency(totalSpendingAllDelta), deltaLabelColor:totalSpendingAllColor},
      { name: 'Checking Balance', value: formatCurrency(currentCheckingBalance), target: formatCurrency(3000), targetLabel:'Target Min Balance', deltaLabel: checkingDeltaLabel,delta: formatCurrency(checkingDelta),deltaLabelColor:checkingColor },
      { name: 'Savings Balance', value: formatCurrency(totalSavings), target: formatCurrency(savingsTarget), targetLabel:'Target', deltaLabel: savingsDeltaLabel,delta:formatCurrency(savingsDelta),deltaLabelColor: savingsColor},
    ];


    res.json(kpis);

  } catch (error) {
    console.error('Error fetching spending:', error);
    res.status(500).json({ error: 'Failed to fetch spending' });
  }


});


app.get('/api/spending', async (req, res) => {
  const { filter } = req.query;
  const { spender } = req.query;
  //console.log(spender)

  const { startDate, endDate } = getStartAndEndDates(filter)// { startDate:"11-01-2024",endDate:"11-30-2024" }
  try {
    // Input validation (crucial for security and robustness)
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate) || isNaN(parsedEndDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.'});
    }

    const filteredSpendings = spendersData[spender].spending_transactions.filter(transaction => {
      return new Date(transaction.TransactionDate) >= parsedStartDate && new Date(transaction.TransactionDate) <= parsedEndDate;
    });
    spendingData = processSpendingCategoryData(filteredSpendings)

    let totalSpendingM = 0
    spendingData.forEach(transaction => {
      totalSpendingM += transaction[1].total
    });

    //console.log(totalSpendingM);
    // console.log(spendingData)
    res.json(spendingData);

  } catch (error) {
    console.error('Error fetching spending:', error);
    res.status(500).json({ error: 'Failed to fetch spending' });
  }


});



app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});


