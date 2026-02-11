## iina Plugin Docs (https://docs.iina.io/)

```zsh
npx repomix \
  --remote https://github.com/iina/iina-website/tree/0dbca44e0f33380c1d7093d416e7e1ded02969ab \
  --remote-branch 0dbca44e0f33380c1d7093d416e7e1ded02969ab \
  -o iina-plugin-docs.md.txt \
  --style markdown \
  --include "source/**/*.{md,slim,html},data/**/*.{yml,yaml,json},assets/**/*.{scss,js},config.rb,package.json,Gemfile" \
  --ignore "assets/images/**/*" \
  --quiet
```

---

## iina Plugin Definition (https://github.com/iina/iina-plugin-definition)

```zsh
npx repomix \                                                                                 1 ✘  3s  04:08:42 PM
  --remote https://github.com/iina/iina-plugin-definition \
  -o iina-plugin-definition-docs.md.txt \
  --style markdown \
  --include "iina/**/*.d.ts,pages/**/*.{md,html},README.md,LICENSE,package.json,tsdoc.json,typedoc.json,tsconfig.json" \
  --ignore "pages/**/*.png,pages/**/*.jpg,**/*.map,dist/**/*" \
  --quiet
```
