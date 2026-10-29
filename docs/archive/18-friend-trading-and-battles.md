# Phase 18 - Friend trading and battles

## Goal
Trade Billies, robots and robot parts with friends, and battle friends. Build this only after the monster and save formats are stable. The data model was planned in phases 02, 16 and 17 so it is not blocked.

## Tasks
1. Asynchronous friend battles first: challenge a friend's saved team and fight it whenever you like, using the existing friends system. Ask me before building live real-time battles.
2. Trading Billies, robots and parts between friends: a two-step confirmation, done as one atomic transaction so nothing is duplicated or lost if a trade fails midway.
3. Enforce fairness and anti-cheating on the server side (Firestore rules or functions), not only in the app: validate teams, levels, abomination stat caps, robot builds and part limits, and that traded Billies, robots and parts really exist in the sender's save.
4. Optional later: friends visiting each other's ranch (phase 12), read-only.
5. Extend the phase 02 friends rules (code-based lookup) to cover the new data.
6. Extend the phase 13 tests: unit tests for trade and battle logic (including robot battles), plus a simulation that tries to break the rules.
7. Privacy: share only what a friend needs (team and Billy data), never save contents or step history.

## Ask me before
Which to build first (recommend an order); live real-time battles.

## Done when
Async battles and atomic trades work between two test accounts, rules are tested, tag `phase-18-done`.

## First reply
Same four items as phase 01, plus a proposed build order.

## Testing (phase 13)
Follow docs/TESTING.md: where new tests go, what must pass before the phase ends, and its section for phase 18.
