from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime


class BEOWeek(models.Model):
    """
    Represents one work week of BEO PDFs.
    label      e.g. "Apr 13–19 2026"
    week_start Monday of that week (used for ordering & pruning)
    """
    label      = models.CharField(max_length=64)
    week_start = models.DateField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['week_start']

    def __str__(self):
        return self.label

    @staticmethod
    def current_week_start():
        today = datetime.date.today()
        return today - datetime.timedelta(days=today.weekday())  # Monday

    @staticmethod
    def make_label(week_start: datetime.date) -> str:
        week_end = week_start + datetime.timedelta(days=6)
        if week_start.month == week_end.month:
            return f"{week_start.strftime('%b')} {week_start.day}–{week_end.day} {week_start.year}"
        return (
            f"{week_start.strftime('%b')} {week_start.day} – "
            f"{week_end.strftime('%b')} {week_end.day} {week_end.year}"
        )

    @classmethod
    def get_or_create_for_week(cls, week_start: datetime.date):
        label = cls.make_label(week_start)
        obj, _ = cls.objects.get_or_create(
            week_start=week_start,
            defaults={'label': label},
        )
        return obj

    @classmethod
    def prune_old_weeks(cls):
        """Keep only 3 weeks: previous, current, next. Delete everything else."""
        today = datetime.date.today()
        mon   = today - datetime.timedelta(days=today.weekday())
        keep_starts = [
            mon - datetime.timedelta(weeks=1),
            mon,
            mon + datetime.timedelta(weeks=1),
        ]
        cls.objects.exclude(week_start__in=keep_starts).delete()


class BEOWeekFile(models.Model):
    """A single PDF file stored for a week."""
    week      = models.ForeignKey(BEOWeek, on_delete=models.CASCADE, related_name='files')
    file_name = models.CharField(max_length=255)
    file_data = models.BinaryField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['file_name']

    def __str__(self):
        return f"{self.week.label} / {self.file_name}"
