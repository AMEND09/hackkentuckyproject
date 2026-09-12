from django.db import migrations, models


JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 6


def populate_join_codes(apps, schema_editor):
    from django.utils.crypto import get_random_string

    District = apps.get_model("districts", "District")
    used: set[str] = set()
    for district in District.objects.filter(join_code=""):
        while True:
            code = get_random_string(JOIN_CODE_LENGTH, JOIN_CODE_ALPHABET)
            if code not in used and not District.objects.filter(join_code=code).exists():
                used.add(code)
                break
        district.join_code = code
        district.save(update_fields=["join_code"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("districts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="district",
            name="join_code",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Shareable code staff and families use to join this district.",
                max_length=12,
            ),
        ),
        migrations.RunPython(populate_join_codes, noop),
        migrations.AlterField(
            model_name="district",
            name="join_code",
            field=models.CharField(
                blank=True,
                help_text="Shareable code staff and families use to join this district.",
                max_length=12,
                unique=True,
            ),
        ),
    ]
