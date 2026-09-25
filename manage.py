import os
import sys


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beto_django.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as error:
        raise ImportError('Instala Django con: python -m pip install -r requirements.txt') from error
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
