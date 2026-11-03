# Security

## Reporting

Please report vulnerabilities through GitHub's private vulnerability reporting on this repository, not in a public
issue. Grow Bot is a preview maintained in spare time, so there is no response time promise.

## What to keep in mind

- Bots run tools on your machine with your user's rights: they can read and write files in the folders you give
  them and run commands. Grow Bot is not a sandbox.
- Data stays on your machine in `~/.ds-bot`. That includes conversations, memory and the credentials for your
  model account, which are kept in a file readable only by your user.
- Messages go to the model provider you choose, and text a Bot reads can try to steer it, so check what a Bot does
  with material you do not trust.
- Builds are not signed or notarized, so verify that you got them from this repository.
