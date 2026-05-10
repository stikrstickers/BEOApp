from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('parse-pdf/', views.parse_pdf, name='parse_pdf'),
    path('bin-list/', views.bin_list, name='bin_list'),
    path('coffee-list/', views.coffee_list, name='coffee_list'),
    path('run-of-show/', views.run_of_show, name='run_of_show'),
    path('weeks/', views.weeks, name='weeks'),
    path('weeks/<int:week_id>/', views.week_detail, name='week_detail'),
    path('weeks/<int:week_id>/files/<int:file_id>/', views.week_file_delete, name='week_file_delete'),
]
