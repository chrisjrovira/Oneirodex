"""Requeue the NES leaf scan while SNES (or any) scan is busy — queues on the live app."""
from oneirodex import create_app
from oneirodex.utils.scan_queue import start_or_queue_scan

NES_UUID = '4cb9e4c4-efd3-45fa-8f53-15770475cef5'
NES_PATH = '/storage/_console-gaming/NINTENDO/Ninentdo Entertainment System'

app = create_app()
with app.app_context():
    result = start_or_queue_scan(
        folder_path=NES_PATH,
        library_uuid=NES_UUID,
        scan_mode='folders',
        queue_policy='queue',
        app=app,
    )
    print(result)
