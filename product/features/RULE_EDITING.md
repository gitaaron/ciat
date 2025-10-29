# Rule Editing

### Overview
Comprehensive rule editing capabilities that allow users to modify existing rules with intelligent re-matching, progress feedback, and state management.

### User Goals
- Edit rules safely with the ability to revert changes
- Understand the impact of rule changes before committing
- Get clear feedback during save operations
- Automatically clean up rules that become obsolete

### Functional Requirements

#### 1. Rule State Management
- **Original state storage**: When editing begins, store the complete original rule state
- **Revert on cancel**: Cancel button restores the rule to its original state before editing
- **State persistence**: Original state is cleared only after successful save or explicit cancel

#### 2. Smart Re-matching Logic
- **Match-affecting changes**: Changes to `match_type` or `pattern` trigger full re-matching of all transactions
- **Non-match changes**: Changes to `category` or `labels` update the rule without re-matching
- **Priority-based processing**: Re-matching respects rule priority order to prevent double-counting

#### 3. Empty Rule Handling
- **Zero matches detection**: If a rule edit results in zero matching transactions, show confirmation dialog
- **User choice**: Allow user to either remove the empty rule or keep it for future use
- **Automatic cleanup**: Remove lower-priority rules that become empty due to higher-priority rule changes

#### 4. Progress Feedback
- **Save indicators**: Show "Saving..." text and disable buttons during save operations
- **Progress tracking**: Track which rules are currently being saved to prevent UI freezing
- **Error handling**: Clear progress indicators on both success and error conditions

#### 5. UI State Management
- **Button states**: Disable save/cancel buttons during save operations
- **Visual feedback**: Clear indication of which rule is being edited and saved
- **Event propagation**: Proper event flow through component hierarchy for state updates

### Technical Implementation

#### Event Flow
1. `startEditing` → Store original state
2. `saveEdit` → Show progress → Re-match (if needed) → Hide progress
3. `cancelEdit` → Revert to original state → Clear stored state

#### State Tracking
- `originalRuleStates`: Map storing original rule states by rule ID
- `ruleSaving`: Set tracking which rules are currently being saved
- Event emissions: `rule-save-start`, `rule-save-end`, `rule-canceled`

#### Component Hierarchy
- `RuleItem` → `RulesReview` → `ManageRules` → `ImportWizard`
- Progress state flows down through props
- Events flow up through emit handlers

### UI Considerations
- **Progress indicators**: Clear visual feedback during save operations
- **Button states**: Disabled state prevents multiple simultaneous saves
- **Error handling**: Graceful degradation on save failures
- **State consistency**: UI always reflects actual rule state

### See Also
- [New Rule Wizard](./NEW_RULE_WIZARD.md)
- [Import Transactions](./IMPORT_TRANSACTIONS.md)
- [Category Matching](./CATEGORY_MATCHING.md)
