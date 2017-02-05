//Top level object
var dataAccess = {};

/*
MongoDB
*/
var mongoClient = require('mongodb').MongoClient;
var connectionUrl = 'mongodb://jamesleeht:sparkle123@ds054619.mlab.com:54619/sparklepocmongo';
var db;

//Called before server start in index to establish reusable connection
dataAccess.connectToDb = function(callback)
{
    mongoClient.connect(connectionUrl, function(err,database){
        if(!err)
        {
            console.log('Successfully connected to database');
            db = database;
            callback();
        }
        else
        {
            console.error('Error connecting to database');
        }
    });
}

dataAccess.getResponse = function(intent, entity, callback)
{
    console.log('Intent: ' + intent);
    console.log('Entity: ' + entity);
    db.collection('responses').findOne({"intent": intent, "entity": entity}, function(err, doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Response not found');
            }
        }
        else
        {
            console.error('Error finding document');
        }
        callback(err, doc);
    });
}

dataAccess.getDoubleEntityResponse = function(intent, mallEntity, secondEntity, callback)
{
    db.collection('responses').findOne({"intent": intent, "mallEntity": mallEntity, "secondEntity": secondEntity}, function(err, doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Response not found');
            }
        }
        else
        {
            console.error('Error finding document');
        }
        callback(err, doc);
    })
}

dataAccess.getTenantByName = function(name, callback)
{
    db.collection('tenants').findOne({"name":toTitleCase(name)}, function(err, doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Tenant not found');
            }
        }
        else
        {
            console.error('Error finding tenant');
        }

        callback(err, doc);
    });
};

dataAccess.getTenantInfo = function(category, tag, callback)
{
    console.log('Category: ' + category);
    console.log('Tag: ' + tag);

    db.collection('tenants').find({"category": category, "tags": tag}).toArray(function(err, doc){
        if(!err)
        {
            if(doc.length > 0)
            {
                console.dir(doc);
            }
            else if(doc.length == 0)
            {
                console.error('Tenant not found');
            }
        }
        else
        {
            console.error('Error finding tenant');
        }
        callback(err, doc);
    });
}

dataAccess.getTenantInfoByCategory = function(category, callback)
{
    db.collection('tenants').find({"category": category}).toArray(function(err, doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Tenant not found');
            }
        }
        else
        {
            console.error('Error finding tenant');
        }
        callback(err, doc);
    });
}

dataAccess.getTenantInfoByTag = function (tags, callback)
{
    db.collection('tenants').find({"tags":{$all:tags}}).toArray(function (err,doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Tenant not found');
            }
        }
        else
        {
            console.error('Error finding tenant');
        }
        callback(err, doc);
    });
}

dataAccess.getTenantInfoByTagAndMall = function (tags, mall, callback)
{
    db.collection('tenants').find({$and:[{"tags":{$all:tags}},{"malls":toTitleCase(mall)}]}).toArray(function(err, doc){
        if(!err)
        {
            if(doc)
            {
                console.dir(doc);
            }
            else
            {
                console.error('Tenant not found');
            }
        }
        else
        {
            console.error('Error finding tenant');
        }
        callback(err, doc);
    });
}

function toTitleCase (str) {  
  if ((str===null) || (str===''))  
       return false;  
  else  
   str = str.toString();  
  
 return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});  
}  

module.exports = dataAccess;