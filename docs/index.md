---
layout: home

hero:
  name: msync
  text: Derived data, kept in sync
  tagline: Describe the derivation the way you would write a MongoDB aggregation. msync runs it once over the data you have, then again on every change.
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: Tutorial
      link: /tutorial/

features:
  - title: One description, two runs
    details: The same stages run as a full pass over the collection and as a before/after delta on each change.
  - title: Joins and sums stay incremental
    details: A renamed account updates the orders that point at it. A deleted order subtracts from the total. The parent is not recomputed from scratch.
  - title: The types follow the projection
    details: A view declares the fields a stream may read. Later stages, lookups, and sinks see that slice and nothing else.
---
