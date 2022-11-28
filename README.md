# Bedrock - Obsidian exporter

## Usage

```
bedrock export <PATH_TO_VAULT>
```

## Setting up automatic Gitlab pages

Create this `.gitlab-ci.yml` file at the root of your repo/vault. Make sure to enable CI/CD and enable shared runners (also that the tags in the job definitions are the right ones).

```yaml
# The Docker image that will be used to build your app
image: registry.gitlab.inria.fr/pberg/bedrock:latest

pages:
  # Depending on your gitlab instance you need to specify specific tags for runners
  tags:
    - linux
    - docker
  script:
    - bedrock export ./ --root-url=$CI_PROJECT_NAME
    # Optionally, you can move more things to the public directory:
    # - mv .obsidian/favicon.ico public/
  artifacts:
    paths:
      # The folder that contains the files to be exposed at the Page URL
      - public
  rules:
    # This ensures that only pushes to the default branch will trigger
    # a pages deploy
    - if: $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH
```
