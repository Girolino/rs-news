git add .; git commit -m 'v 00.00.03 chore: documentation'; git push origin main
git reset --hard; git clean -fd; git checkout dev-branch; git pull origin dev-branch
git reset --hard c2366a1
git push --force origin dev-branch

git reset --hard; git clean -fd; git checkout main; git pull origin main
