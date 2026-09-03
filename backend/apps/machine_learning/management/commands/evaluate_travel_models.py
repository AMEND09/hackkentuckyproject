from django.core.management.base import BaseCommand

from apps.machine_learning.services.training import evaluate_models


class Command(BaseCommand):
    help = "Evaluate active synthetic travel models."

    def handle(self, *args, **options):
        result = evaluate_models()
        self.stdout.write(self.style.SUCCESS(str(result)))
