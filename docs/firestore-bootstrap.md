# Carga inicial (bootstrap) de Firestore

Como Firestore esta en modo produccion, inicia vacio. Este proyecto usa una allowlist para admin:

- Coleccion: `admins`
- Documento: `admins/{uid}`

La app solo deja entrar a `/admin` si existe ese documento.

## Opcion recomendada: Seed con script

1) En Firebase Console, descarga un Service Account JSON:

- Project settings -> Service accounts -> Generate new private key

2) Guardalo localmente, por ejemplo:

- `./.secrets/service-account.json`

No lo subas al repo.

3) Ejecuta el seed:

```bash
npm run seed:firestore -- --serviceAccount ./.secrets/service-account.json --projectId z-suite-academic-evl --adminUid ivtJjphL6dddmf8K75eUVhuCf0F3 --adminEmail zapataval2304@gmail.com --input ./docs/question-bank.example.json
```

Esto crea:

- `admins/{uid}` (admin habilitado)
- `groups/{id}`, `subjects/{id}`, `moments/{id}` desde el JSON
- `questions/{id}` (solo si no existe: append-only)
- `examTemplates/{id}` (solo si no existe)

## Opcion manual (rapida)

1) Firestore -> Data
2) Crea coleccion `admins`
3) Crea documento con ID `ivtJjphL6dddmf8K75eUVhuCf0F3`
4) Agrega el campo `enabled: true`

## Nota sobre Storage

No necesitas Storage para esta etapa. El importador por archivo se puede hacer mas adelante.
