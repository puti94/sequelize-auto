/**
 * User: puti.
 * Time: 2020-05-17 23:38.
 */
// 不能删除,提供eval 需要的环境
const { DataTypes } = require("sequelize");
const _ = require("lodash");

function getLengthType(typeValue, typeStr, isStr, { mapInt2Bool } = {}) {
  const length = typeValue.match(/\(\d+\)/);
  return "DataTypes." + typeStr + (!_.isNull(length) ? length : "");
}

function replaceText(text) {
  return text.replace(/[\r\n]/g, "").replace(/['"]/g, "\\\"");
}

function getKeyName(name) {
  return /^[a-zA-Z_]*$/.test(name) ? name : `'${name}'`;
}

function mapType(attrValue, isStr, { mapInt2Bool = true } = {}) {

  const realType = (type) => {
    return isStr ? type : eval(type);
  };

  const _attr = (attrValue || "").toLowerCase();
  if (attrValue.indexOf("ENUM") === 0) {
    let values = attrValue.match(/\((.+?)\)/);
    values = values ? values[0] : "";
    values = values.substring(1, values.length - 1).split(",");
    const strings = values.filter(t => t);
    return `DataTypes.ENUM(${strings.map(t => `"${t}"`).join(",")})`;
  }
  let type;
  if (_attr === "boolean" || _attr === "bit(1)" || _attr === "bit") {
    type = "DataTypes.BOOLEAN";
  } else if (_attr.match(/^(smallint|mediumint|tinyint|int)/)) {
    const length = _attr.match(/\(\d+\)/);
    const unsigned = _attr.match(/unsigned/i);
    const zero = _attr.match(/zerofill/i);
    if (!length && !unsigned && !zero) {
      type = "DataTypes.INTEGER";
    } else {
      type = `DataTypes.INTEGER({${length ? `length:${length},` : ""}${unsigned ? "unsigned: true," : ""}${zero ? "zerofill: true," : ""}})`;
    }
  } else if (_attr.match(/^bigint/)) {
    type = "DataTypes.BIGINT";
  } else if (_attr.match(/^varchar/)) {
    type = getLengthType(_attr, "STRING", isStr);
  } else if (_attr.match(/^double/)) {
    const length = attrValue.match(/\((.+?)\)/);
    type = "DataTypes.DOUBLE" + (!_.isNull(length) ? length[0] : "");
  } else if (_attr.match(/^string|varying|nvarchar/)) {
    type = "DataTypes.STRING";
  } else if (_attr.match(/^char/)) {
    type = getLengthType(_attr, "CHAR", isStr);
  } else if (_attr.match(/^real/)) {
    type = "DataTypes.REAL";
  } else if (_attr.match(/^tinytext/)) {
    type = "new DataTypes.TEXT('tiny')";
  } else if (_attr.match(/^longtext/)) {
    type = "new DataTypes.TEXT('long')";
  } else if (_attr.match(/^mediumtext/)) {
    type = "new DataTypes.TEXT('medium')";
  } else if (_attr.match(/^longblob/)) {
    type = "new DataTypes.BLOB('long')";
  } else if (_attr.match(/^mediumblob/)) {
    type = "new DataTypes.BLOB('medium')";
  } else if (_attr.match(/^tinyblob/)) {
    type = "new DataTypes.BLOB('tiny')";
  } else if (_attr.match(/^blob/)) {
    type = "new DataTypes.BLOB";
  } else if (_attr.match(/text|ntext$/)) {
    type = "DataTypes.TEXT";
  } else if (_attr === "date") {
    type = "DataTypes.DATEONLY";
  } else if (_attr.match(/^(date|timestamp)/)) {
    type = "DataTypes.DATE";
  } else if (_attr.match(/^(time)/)) {
    type = "DataTypes.TIME";
  } else if (_attr.match(/^(float|float4)/)) {
    type = "DataTypes.FLOAT";
  } else if (_attr.match(/^decimal/)) {
    type = "DataTypes.DECIMAL";
  } else if (_attr.match(/^(float8|double precision|numeric)/)) {
    type = "DataTypes.DOUBLE";
  } else if (_attr.match(/^uuid|uniqueidentifier/)) {
    type = "DataTypes.UUID";
  } else if (_attr.match(/^jsonb/)) {
    type = "DataTypes.JSONB";
  } else if (_attr.match(/^json/)) {
    type = "DataTypes.JSON";
  } else if (_attr.match(/^geometry/)) {
    type = "DataTypes.GEOMETRY";
  } else if (_attr.match(/^array/)) {
    //TODO array 类型暂时定义为为 DataTypes.ARRAY(DataTypes.STRING)
    type = "DataTypes.ARRAY(DataTypes.STRING)";
  } else if (_attr.match(/^varbinary/)) {
    //TODO varbinary 类型暂时定为DataTypes.STRING.BINARY
    const length = _attr.match(/\(\d+\)/);
    type = `DataTypes.STRING(${length || 255},true)`;
  } else {
    type = `"${attrValue}"`;
    throw new Error("无法识别类型" + _attr);
  }
  return realType(type);
}

/**
 * 判断是否是有引用键
 * @param obj
 * @returns {boolean}
 */
function isReferences(obj) {
  return "references" in obj && "model" in obj.references && "key" in obj.references;
}

/**
 * 判断是否是多对多关系的中间表
 * // TODO 判断方式待优化
 * @param model
 * @returns {boolean}
 */
function isMiddleTable(model) {
  const rawAttributeKeys = Object.keys(model.rawAttributes);
  const referencesFields = rawAttributeKeys.filter(key => isReferences(model.rawAttributes[key]));
  const referencesModels = referencesFields.map(key => model.rawAttributes[key].references.model);
  if (referencesModels.length <= 1) return false;
  //通过判断引用模型不少于2个
  // @ts-ignore
  return Array.from(new Set(referencesModels)).length >= 2;
}

/**
 * 自动绑定关联关系
 * @param models
 */
function autoBindAssociate(models) {
  Object.keys(models).forEach((modelName) => {
    const currentModel = models[modelName];
    if (currentModel.associate && typeof currentModel.associate === "function") {
      const result = currentModel.associate(models);
      //此处判断如果模型的关系方法返回true，则不进行自动关联
      if (result === true) return;
    }
    const referencesFields = Object.keys(currentModel.rawAttributes).filter(key => isReferences(currentModel.rawAttributes[key]));
    if (isMiddleTable(currentModel)) {
      referencesFields.forEach(key => {
        const sourceReferences = currentModel.rawAttributes[key].references;
        const source = models[sourceReferences.model];
        const otherFields = referencesFields.filter(t => t !== key);
        otherFields.forEach(field => {
          let targetReferences = currentModel.rawAttributes[field].references;
          const target = models[targetReferences.model];
          source.belongsToMany(target, {
            through: { model: currentModel },
            foreignKey: key,
            constraints: false
          });
          console.log(source.name + " belongsToMany " + target.name + " through " + currentModel.name);
        });
      });
    } else {
      referencesFields.forEach(key => {
        const attribute = currentModel.rawAttributes[key];
        const referencedTable = models[attribute.references.model];
        // TODO 由于不能判断一对一和一对多关系的区别，所有都断定为一对多
        currentModel.belongsTo(referencedTable, { foreignKey: key });
        referencedTable.hasMany(currentModel, { foreignKey: key });
        console.log(referencedTable.name + " hasMany " + currentModel.name + " with key " + key);
        console.log(currentModel.name + " belongsTo " + referencedTable.name + " with key " + key);
      });
    }
  });
}


/**
 * 生成 index.js 导出项
 * @param tableNames
 * @param isCamelCase
 * @returns {string}
 */
function generateIndexExplorer(tableNames, {
  camelCase,
  upperFirstModelName,
  camelCaseForFileName
}) {
  let fileTextOutput = `
${isReferences}
${isMiddleTable}
${autoBindAssociate}
module.exports = function getModels(sequelize) {
  const models = {
`;
  for (let i = 0; i < tableNames.length; i++) {
    let tableForClass = camelCase ? _.camelCase(tableNames[i]) : tableNames[i];
    tableForClass = upperFirstModelName ? _.upperFirst(tableForClass) : tableForClass;
    const tableForFile = camelCaseForFileName ? _.camelCase(tableNames[i]) : tableNames[i];
    fileTextOutput += getKeyName(tableForClass) + ": require('./" + tableForFile + "')(sequelize),\n";
  }
  fileTextOutput += `  };
  autoBindAssociate(models);
  return models;
};`;
  return fileTextOutput;
}


module.exports.mapType = mapType;
module.exports.autoBindAssociate = autoBindAssociate;
module.exports.isMiddleTable = isMiddleTable;
module.exports.isReferences = isReferences;
module.exports.generateIndexExplorer = generateIndexExplorer;
module.exports.getKeyName = getKeyName;
module.exports.replaceText = replaceText;