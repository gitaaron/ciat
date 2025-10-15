# Transaction Import

It should have a way to import my previous transactions from all of my accounts at once using common banking file formats.

    * the file formats that it should support are .csv (comma or tab delimited) and .qfx (quicken file format)

    * when importing transactions:

        * I should be able to drag/drop a single file for each account onto the page at once

    * after importing transactions:

        * prompt to select the account that the transaction file that is being imported from by providing me with a dropdown of options

            * I also will need the ability to create the accounts

                * in the 'accounts' section where I can create the accounts I can also see a list of all accounts created along with the ability to rename and delete them

            * use string matching to guess the filename account mapping in the future



        * try to come up with a best guess of what category each transaction belongs to (based on category guessing algorithm)

        * handles the fact that a transaction may be coming out of one account and into another account (eg/ paying off credit card) and so ignores them

        * handles the fact that I may import the same transaction more than once


        * instead of showing a list of transactions for each category show a list of rules that were created

            * clicking 'expand' on the rule shows a list of the transactions that it effects

            * I should be able to edit or delete rules

                * if I edit or delete a rule I should preview a list of all the transactions it would effect

            * rules for each category are shown step by step starting in the following order: fixed, investments, guilt free, short term



    * the categorization algorithm that is applied from cmd line is the same as the categorization applied during import


