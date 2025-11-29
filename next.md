# Next

* sunlife meds shoud not be considered 'income' should be put under 'short term' with label `health_coverage`

---

* browser becomes unresponsive after updating controls when clearing category

---

When creating an account model an additional field called 'initial balance' should be included.

    The script should accept 'initial balance' for each account in the config.

    The UX should also ask the user for this when creating a new account.

    During the account creation process the initial balance is used to create an initial transaction using the first date from the accompanying transaction file.

---

At the bottom of the reports tab include a new card that contains a list of all accounts along with their 'current balance' based on all transactions for that account.

---

Fix pair finding?

---

Make it so that script import gets right income

    - script needs to categorize proper transactions income

        - account

        - amount range

    - show monthly / annual net salary in reports (maybe hide total income or rename to total income)

    - script should categorize most spends into fixed, short term, guilt free, transfer, investments

---

Bucket list -

    - should be persised to db or flat file in backend

    - total surplus should be based on deviation in short term savings + guilt free + 

    - rows should be drag / droppable

    - show an estimated savings monthly rate at the top (calculated based on savings over time)

    - for each item if the 'remaining' amount is in the hole then show the target date when funds will become available based on the current savings rate

---

---

System level rules should be in their own flat json file.

    - if bank account mark inflow as income automatically

    - if credit card amount mark inflow as transfer and look for matching pair in all bank accounts

    - look for pairs (eg/ 29.95)

---

Create a cmd line script that imports all transactions apply system level rules.

    - accounts is loaded from external config file
        - account name
        - account type
        - path
        - final balance (to determine initial transaction)

---

When importing 'aventura visa' why are there transactions from 2022 showing up?

---

Instead of having a `match_type` `inflow`, each rule should have another field called 'direction'.  It matches transactions that are inflow only, outflow only, or both.

When a rule is auto generated, it should have the outflow only option as the default.

The 'system level' rule that matches 'inflow' transactions should still be used although it should just exist and not be part of 'autogen' rules instead it should be in a new section at the bottom of the 'rules review' called 'system level'.

---

During import after drag/dropping file next to account selection there should be an option to include a 'start date'.  Any transactions before this start date will not be imported.

If there are already transactions in the system then the start date should be prepopulated with the first transaction in history in the system.  This should use the same function in the start date filter of the reports or transactions tab.

---

When creating a new account specify if it is a 'credit card' or 'bank' account.

When importing transactions for a credit card account that has not had an import done before after reviewing map CSV field, show a dialogue that recommends creation of an initial "balance" transaction to ensure that the account goes to zero.  To calculate the amount  and inflow/outflow of the "balance" transaction calculate the total surplus or deficit of all the transactions in the account and it should be the inverse that takes the account balance to 0.  The date of the "balance" transaction should be the first day of the transactions being imported.

---

Search by amount (< > =)

---

Create / edit rules with amount (< or >)

---

I should be able to search for transactions that are pairs instead of just excluding pairs. The function that excludes pairs should just call the function that produces matching pairs. It then calls another function that takes the inverse (passes full list of transactions with pair transactions and provides all transactions that are not in the pair list).

---

I should be able to create a new rule from a transaction itself in the transaction manager.

---

I should be able to alter the category of a batch of transactions based on filter criteria in transaction management.

After applying, I can save these 'search criteria mappings' and they will get applied after import and after 'reapply' in rules management.

The search criteria mappings are persisted to a flat file (similar to system rules).

I can view the list of 'saved search criteria mappings' (from rules management?) and delete them or click on them to open transactions with same filters to see what has been applied.

---

Create a new category called 'income'.

Also create a system level rule that maps any transaction that has 'inflow' true to this 'income' category.  This system level rule would take the lowest precedence and any other rule (auto or user generated) would take a higher precedence.  However, auto generated rules should only be create from outflow transactions.

For the reports tab nothing should have to change because these transactions in the new category would still have the 'inflow' property set on them and the income category should not show up in the pie or line charts.

For the transactions tab it should show up in the category selection dropdown right above transfers.

In the filter section also add a new radio button with options 'inflow only', 'outflow only', 'both' with 'both' being default.

---

Why is 'hide net zero' changing total defecit?

---

After import why are so many inflow getting assigned to guilt free, fixed cost and short term saving?

---

During import when trying to manually edit category on uncategorized during transaction review it won't let me.

---

Handle case where txns file importing does not import any new txns by just showing message with a button 'back to import' that goes back to screen for adding a txn file and resets everything.

---

when uploading txns for an account i have already uploaded for it is not saving selections (could be if i select defaults)

---

move 'create rule' and 'reapply rule' buttons to top of transactions page

when clicking 'reapply rule' show a modal with all transactions that will change along with their old / new categories and a 'confirm' button

---

Transaction amount balancing

    - ability to manually create transactions (eg/ one on sep 28 in amount that makes account go to 0)

        - triggers reports refresh


---

Income and transfers should be their own category?

---

During rules import there are still rules showing up with zero transactions

---

Reports Income / Salary:

    * extra compensation stats

        * should be based on transactions with label "compensation"

        * if no transactions are labelled then show message 'label your transactions as compensation first'

    * after this our net annual compensation should be around ~$150K

---

During preview optionally detect credit card

---

When reviewing transactions in rules review transactions they should show if they are income or expense

---

Infow and outflow seems to be in different places in each .csv so when importing a csv for a certain account for the first time I should be shown a table with a preview of the first five transactions along with guesses for each field.

- date
- merchant name
- inflow
- outflow

It asks me to very the fields and the user can then select each header in the table to set its field manually

after clicking next the field mapping gets saved to the account entity in the accounts table 

this is now the first step in the import wizard that gets skipped when a user has already set the fields for the account

i should also be able to click on an account and edit these fields (with a preview of 5 transactions from the account) - use the same table as used in the import wizard

---

targets are not editable

---


---

Instead of having a special inflow field the transaction should just be categorized as 'income' meaning the rule matcher should check fs the transaction is income as its first step and set the category to 'income' and return.

---

it should be possible to remove and edit labels for a transaction from the transctions tab

---

when coming up with default category targets:

   - investments should stay at 10%, fixed costs and guilt free should be set such that their net is 0 (in other words no surplus or defecit), short term savings is calculated as 100-fixed-investments-guilt free


---


- make ‘transfer’ a category instead of label

- new category called ‘income’

- pie chart excludes ‘income’ and ‘transfer’ categories

- there needs to be a way to see that the ‘net’ of transfers is negative

- show net income

- how can i calculate my net annual and monthly income?


---

- label filter seems to be not working

- in the transactions tab the start and end date should be prepopulated with the date of the first and last transactions


---

- in transactions tab, clicking on the title of a transaction in the transactions table should pull up the rule that it matches unless it is overridden with `manual_override` set to true

- in rules tab there should be a section in each rule similar to rules review where i preview a transaction and a way to expand and see all transactions that the rule matches

- after clicking 'reapply rules' it should show the exact number of transactions that were changed - right now it seems to be updating all transactions

---


- when editing a rule after import include label

- 'payment thank you' goes into 'fixed costs' with label `credit_card_payment`

---

- auto generate rules

    - when a rule is generated how is the category determined?

    - how is confidence determined?

    - recurring window should be +- 10 days

    - there should be no max on auto rules generated (currently 50?)

    - reduce category confidence to 0, 10, 20 and see what happens

    - conflict resolution

        - is this part of rule auto generation process or part of transaction -> category mapping process with all rules?

        - is this necessary if transactions are removed after creating a matching rule?

    - create an 'exclude' list that is a list of rules

    - higher token patterns should be given provide over lower token patterns
        - higher character words should also be given priority over lower character rules

    - reapply categories should not be called in backend when rules are saved - instead it should be called from frontend after transactions are reviewed

    - explanation for autogenerated rules should just say 'auto'

    - submit any transactions without autogenerated rules to LLM?

---

- during import instead of showing a "save rules" button show a "review transactions" button
    - clicking the "review transactions" button does not persist the rules to the backend
    - instead the "import transactions" button should be renamed to "save"
    - clicking 'save' at the final step updates persists both rules and transactions similarly to how they are currently persisted


---

- the "manage rules" should should use the same "rules review" components as used during import

- from the "manage rules" section after editing a set of rules
    - display a 'review transactions' button at the bottom when clicking displays:
        - the transactions table for review (same view component as used during import)
        - save button that updates both rules and transactions

- improve 'auto generate rules' algo

    - "the home depot #7073 EAST YORK" should result in "the home depot" or "home depot" instead of "the"


- review and clean up code ensuring that ‘pre existing’ rules are handled similarly to ‘auto generated’ rules 

    - the only thing that should be different is the rules list they are operating on

—

- review ‘auto generated’ rules logic

—

- fix logic for adding new rules
    - it should not get created in back-end until ‘continue to import’ button is pressed similarly as auto generated rules

—

- after importing, why do all auto generated rules say “50 transactions” ?  for example, ‘west’ says 50 transactions but then says “west” appears 150 times

- how is ‘confidence’ determined?

- explain auto generated rule stats

- after auto generating rules why are there still transactions that do not match any rules?

- what does the ‘delete rule’ action do?

    - when importing rules and showing auto generated rules, update the ‘delete’ rule action so that it prompts the user if they want to add it to an exclude list; if the user says “yes” then the same auto generated rule should not be created in the future; excluded rules should be persisted


- rules should have a field ‘source’ that is enum of either ‘auto’ or ‘user’ and rule cards should include this instead of ‘USER_RULE’

    - when creating an auto-generated rule the explanation should be empty
