# Product Requirements

CIAT is a family budgeting app based off of Remit Sethi's 'IWT' system.

It looks at your expenses and breaks them down into the four categories:

    * guilt free

    * short term savings

    * fixed costs

    * investments

It should provide the following:

    * a pie chart that shows the breakdown of money flow into each category

    * a list of all transactions

        * I should be able to search by name/transaction amount

        * I should be able to filter by date range and category

        * I should be able to sort by transaction date, transaction amount or name (alphabetic)

        * I should be able to edit the transaction category

        * line graphs showing breakdown of spending by month

        * I should be able to add a note to the transaction that is also searchable later


It should have a way to import my previous transactions from all of my accounts at once using common banking file formats.

    * when importing transactions, I should be able to drag/drop all files for each account onto the page at once

    * after importing transactions:

        * prompt to select the account that the transaction file that is being imported from by providing me with a dropdown of options

            * I also will need the ability to create the accounts

            * use string matching to guess the filename account mapping in the future

        * try to come up with a best guess of what category each transaction should belongs to (based on category guessing algorithm)


        * handles the fact that a transaction may be coming out of one account and into another account (eg/ paying off credit card) and so ignores them

        * handles the fact that I may import the same transaction more than once

        * shows me the list of transactions that have not already been imported to review before importing where I can correct a category if needed then hit save

            * shows transaction for each category step by step starting in the following order: fixed, investments, guilt free, short term

            * I should be able to add a note to the transaction that is also searchable later


    * the categorization algorithm that is applied from cmd line is the same as the categorization applied during import

## New Category Wizard

* when a new categorization override rule is created then all transactions that change according to the new rule are presented for review before saving the new rule

    * the user has the ability to update the rule or create a list of rules where the most recently created ones take the highest precedence


* after new rule(s) are created reapply the categorization over all transactions so that they are in agreement with latest categorization rules

## Persistence

It should persist all data to disk so that if the app is restarted or browser is refreshed then all previously recorded data to use the app is not lost.

## Category Guessing

Based on rules then pattern matching then ML text classifier.

Rules and pattern matching are from separate flat config files.

There should be a cmd line script that can be run to reapply category guessing to all transactions that have not been manually overridden.

### Sample Rules

- **Cash withdrawals**: Default to “Guilt Free” unless user specifies otherwise.


### Pattern Matching Rule Types

- **merchant_exact**: `merchant_normalized == "STARBUCKS"`
- **merchant_contains**: `"AMZN"` in `description_normalized`
- **merchant_regex**: `/\bTORONTO\s*HYDRO\b/i`

### Each rule stores:
- **category**: `"fixed_costs" | "short_term_savings" | "guilt_free" | "investments"`
- **match_type**: `"exact" | "contains" | "regex"
- **pattern**: String or JSON payload (merchant text, regex, or account pair)
- **priority**: Int (higher wins)
- **enabled**: Bool
- **created_at / updated_at**
- **explain**: Short human-readable reason


### New merchants not found by category guessing algorithm

* go to chatGPT api and ask it to guess the right category

    * all new merchants should go in a single request to the API when the transactions are imported

    * ask chatGPT to provide an update for the pattern matching and/or rules file based on new transactions and update it accordingly

    * pattern matching file should be part of git history

-
### Feedback Loop

Accuracy improves over time:

1. Show the guessed category.
2. Allow user to correct it.
3. Store correction in dictionary or training dataset.
4. Iterate → accuracy converges to >90% for personal spending patterns.

### Turning User Overrides into New Categorization Rules

#### Design Goals

- **User-first precedence**: A user-created rule must always win.
- **Low-latency & explainable**: Rules are simple, readable, and return a short “why” string.
- **Incremental**: Start with exact/contains/regex rules; expand to amount/frequency when needed.
- **Safe**: Avoid retroactively breaking prior classifications; store versions and timestamps.

## Targets for each category

Before importing, the user is asked to guess a target spending amount based on their net income. (eg/ 35% for fixed, 15% short term, 40% guilt free, 10% investments)

* it should be possible to manually edit the target percentages

* close to where each target is displayed there is a smaller number to the bottom right of it that shows what the historical average for the target

* in the target section, there should be a number that displays what the surplus or defecit is based on historical spending vs what the target is

    * calculation is based on the total income * category target vs spending in each category
