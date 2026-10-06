const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // Replace variations of the word
  newContent = newContent.replace(/الطابور/g, 'الدور');
  newContent = newContent.replace(/طابور/g, 'دور');
  newContent = newContent.replace(/الطوابير/g, 'الأدوار');
  newContent = newContent.replace(/طوابير/g, 'أدوار');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log('Updated:', filePath);
  }
}

function walkSync(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
}

const files = walkSync('./src');
files.forEach(replaceInFile);

console.log('Done replacing words.');
