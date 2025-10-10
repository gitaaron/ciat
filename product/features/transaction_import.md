# Transaction Import

It should have a way to import my previous transactions from all of my accounts at once using common banking file formats.

    * the file formats that it should support are .csv (comma or tab delimited) and .qfx (quicken file format)

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


