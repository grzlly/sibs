# grzlly sibs loader

```javascript
eval(await (await fetch('https://grzlly.github.io/sibs/1.js?t=' + Date.now(), {cache:'no-store'})).text())
```

### Резервный вариант (DOM Script):
```javascript
document.body.appendChild(document.createElement('script')).src='https://grzlly.github.io/sibs/1.js?t='+Date.now()
```
