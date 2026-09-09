"""Pydantic request models for JSON API routes (wave A2.4).

One module per route surface (``game``, ``collections``, ``ownership``,
``scan``, ...). A route module imports its model from here and wraps the view
with :func:`oneirodex.utils.validation.validate_body`::

    from oneirodex.schemas.collections import CreateCollectionBody
    from oneirodex.utils.validation import validate_body

    @apis_bp.route('/collections', methods=['POST'])
    @login_required
    @validate_body(CreateCollectionBody)
    def create_collection(body: CreateCollectionBody):
        ...

Conventions
-----------
* ``model_config = ConfigDict(extra='forbid')`` on every model unless a route
  genuinely accepts pass-through keys — an unknown key is a client bug worth
  a 422, not silence.
* Keep *semantic* checks that need the database or app state (does this game
  exist, is every uuid in the collection, is the caller an admin) in the view.
  The model only covers shape, type and presence.
* The happy-path response of a migrated route must not change — models are
  sized to accept exactly what the current hand-rolled checks accept.
"""
