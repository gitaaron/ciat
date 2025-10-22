- after importing, why are rules that appear in ‘ backend/src/categorizer/rules.json’ show up as auto generated rules?

—

- review and clean up code ensuring that ‘pre existing’ rules are handled similarly to ‘auto generated’ rules (the only thing that should be different is the rules list they are operating on

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