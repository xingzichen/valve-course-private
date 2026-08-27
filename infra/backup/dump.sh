#!/bin/sh
set -eu

mkdir -p /staging
pg_dump --format=custom --no-owner --no-acl --file=/staging/database.dump
pg_dumpall --globals-only --file=/staging/globals.sql
date -u +%Y-%m-%dT%H:%M:%SZ > /staging/created-at.txt
