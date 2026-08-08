/**
 * File purpose:
 * The shape every Dashboard section uses when it has nothing to show.
 *
 * Rendered by:
 * - AttentionSpine, Pipeline, ActivityStream, FinanceTrendChart
 *
 * WHY ONE COMPONENT AND NOT ONE DESIGN
 * The sections share a STRUCTURE — what this is, why it is empty, what happens
 * next — but never share COPY. "No payments recorded yet" and "No tenders yet"
 * mean different things and lead to different places, so each caller supplies
 * its own sentence and its own single action. What is shared is the shape, so
 * five empty sections read as one product rather than five unfinished screens.
 *
 * NO ILLUSTRATION
 * Deliberately none. An icon or spot drawing repeated across five sections
 * becomes decoration that says nothing, and any information carried only by a
 * picture is unavailable to a screen reader. Type and one link carry it.
 *
 * ONE ACTION, OPTIONAL
 * `action` is a single destination or nothing. Two actions in an empty state
 * is a menu, and a user who has just arrived does not need a decision — they
 * need the next step. Sections whose next step is not a Dashboard concern
 * (Activity, for instance, which fills as a side effect of other work) pass no
 * action at all rather than inventing one.
 *
 * QUIET BY DEFAULT
 * An empty section must not out-shout a populated one. This renders as a
 * sunken block with body-size text, never a card with a border and a heading
 * competing with the section title above it.
 */

import AppLink from "../ui/AppLink";

function EmptyState({ title, description, action = null, tone = "default" }) {
  return (
    <div className="ui-empty" data-tone={tone}>
      <p className="ui-empty__title">{title}</p>

      <p className="ui-empty__description">{description}</p>

      {action ? (
        <AppLink to={action.to} className="ui-empty__action">
          {action.label}
        </AppLink>
      ) : null}
    </div>
  );
}

export default EmptyState;
