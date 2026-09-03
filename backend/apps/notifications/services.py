from apps.accounts.models import User, UserRole
from apps.notifications.models import Notification


def notify_roles(district, roles, title, body, event_type, payload=None):
    users = User.objects.filter(district=district, role__in=roles, is_active=True)
    Notification.objects.bulk_create(
        [
            Notification(
                district=district,
                user=u,
                title=title,
                body=body,
                event_type=event_type,
                payload=payload or {},
            )
            for u in users
        ]
    )
