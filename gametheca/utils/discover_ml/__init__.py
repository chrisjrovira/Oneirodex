"""On-box recommendation for Discover.

Everything here derives from signals the install already stores — what the
member favourited, played, owns, downloaded, marked finished — against metadata
already scraped. Nothing leaves the box, which is the same stance the rest of
the product takes, and there is no model file, no embedding step and no heavy
dependency in the default install.

The honest shape of the problem, stated once so it is not rediscovered later:

* **Content is the primary engine.** Scoring a title by how much its facets
  overlap what a member already reaches for works with one member and a cold
  library. It is the thing that actually runs on a self-hosted box.
* **Collaborative signal is a bonus, not a foundation.** "People who played
  this also played that" needs a population. On an install with four members,
  two titles co-occurring once is indistinguishable from coincidence, and a
  recommender built on it will confidently surface nonsense. It is written, and
  it stays dark below a population floor.
* **Freshness is rotation, not modelling.** The reason the same tiles greet
  somebody every morning is that nothing remembers having shown them. Impression
  damping moves that needle further at this scale than the recommender does.

Everything expensive is materialised by :mod:`gametheca.utils.discover_ml.job`.
The request path only ever reads.
"""
