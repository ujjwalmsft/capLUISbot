/*
NPM
*/
var restify = require('restify');
var builder = require('botbuilder');

/*
Internal modules
*/
var dataAccess = require('./data_access');

/*
Setup
*/
//Setup restify server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function(){
    console.log('%s listening to %s', server.name, server.url);
});

//Setup chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);

//Open connection to database before listening on server
dataAccess.connectToDb(function(){
    server.post('api/messages', connector.listen());
});

/*
Intents
*/
//Attach LUIS
var luisUrl = 'https://api.projectoxford.ai/luis/v2.0/apps/9ba230ec-392f-4793-8156-1504a74caee6?subscription-key=61fe645b6056470cba59a88b0d6d927d&verbose=true';
var luisRecognizer = new builder.LuisRecognizer(luisUrl);
var intentDialog = new builder.IntentDialog({recognizers: [luisRecognizer]});

//Set root dialog
bot.dialog('/', intentDialog);

//Handle intents
intentDialog.onDefault(builder.DialogAction.send('Sorry, I didn\'t understand that.'));
intentDialog.matches('GetMallAddress', '/mallDetailsDialog');
intentDialog.matches('GetOperatingHours', '/mallDetailsDialog');
intentDialog.matches('GetParkingCharges', '/mallDetailsDialog');
intentDialog.matches('GetServices', '/mallServicesDialog');
intentDialog.matches('GetTenant', '/tenantDialog');
intentDialog.matches('GetTenantInfo', '/tenantInfoDialog');

/*
Dialogs
*/
//Dialog for mall details
bot.dialog('/mallDetailsDialog', [
    function(session, args)
    {
        //Get LUIS detected intent and entity
        var intent = args.intent;
        var detectedMallEntityWrapper = builder.EntityRecognizer.findEntity(args.entities, 'Mall');
        
        //Set mallEntity to detected entity, fallback on user context
        var mallEntity;
        if(detectedMallEntityWrapper) { mallEntity = detectedMallEntityWrapper.entity; }
        else { mallEntity = session.userData.currentMall; }

        //Handle mallEntity
        if(mallEntity)
        {
            dataAccess.getResponse(intent, mallEntity, function(err, doc){
                if(doc)
                {
                    //Check for canned response
                    if(!doc.choices)
                    {
                        //Set user's current mall
                        session.userData.currentMall = mallEntity;
                        session.endDialog(doc.response);
                    }                    
                    else
                    {
                        session.dialogData.intent = intent;
                        builder.Prompts.choice(session, doc.response, doc.choices);
                    }
                }
                else if(!doc)
                {
                    session.endDialog('Sorry, we couldn\'t find that mall.');
                }
                else if(err)
                {
                    session.endDialog('Error connecting to database.');
                }
            });
        }
        else
        {
            session.endDialog('No mall name was specified.');
        }
    },
    function(session, results)
    {
        var intent = session.dialogData.intent;
        var selectedChoice = results.response.entity;

        //Set user's current mall
        session.userData.currentMall = selectedChoice;
        dataAccess.getResponse(intent, selectedChoice, function(err,doc)
        {
            if(!err)
            {
                session.endDialog(doc.response);
            }
            else if(err)
            {
                session.endDialog('Error connecting to database.');
            }
        });
    }
]);

//Dialog for mall services
bot.dialog('/mallServicesDialog', [
    function(session, args)
    {
        //Get LUIS intent and entity
        var intent = args.intent;
        var detectedMallEntityWrapper = builder.EntityRecognizer.findEntity(args.entities, 'Mall');
        var detectedServiceEntityWrapper = findSuperEntity(args.entities, 'MallService');

        //Set mallEntity to detected entity, fallback on user context
        var mallEntity;
        if(detectedMallEntityWrapper) { mallEntity = detectedMallEntityWrapper.entity; }
        else { mallEntity = session.userData.currentMall; }

        //Set serviceEntity to detected entity
        var serviceEntity;
        if(detectedServiceEntityWrapper){ serviceEntity = detectedServiceEntityWrapper.type; }

        //Handle mallEntity/serviceEntity
        if(mallEntity && serviceEntity)
        {
            dataAccess.getDoubleEntityResponse(intent, mallEntity, serviceEntity, function(err, doc){
                if(doc)
                {
                    //Check for canned response
                    if(!doc.choices)
                    {
                        //Set user's current mall
                        session.userData.currentMall = mallEntity;
                        session.endDialog(doc.response);
                    }
                }
                else if(!doc)
                {
                    session.endDialog('Sorry, we couldn\'t find that mall.');
                }
                else if(err)
                {
                    session.endDialog('Error connecting to database.');
                }
            });
        }
        else if(mallEntity && !serviceEntity)
        {
            session.endDialog('No service was specified');
        }
        else if(!mallEntity)
        {
            session.endDialog('No mall name was specified.');
        }
    }
]);

//Dialog for tenant name
bot.dialog('/tenantDialog', [
    function(session, args)
    {
        //Get LUIS intent and entity
        var intent = args.intent;
        var detectedNameEntityWrapper = builder.EntityRecognizer.findEntity(args.entities, 'Tenant::Name');

        //Resolve entities
        var nameEntity;
        if(detectedNameEntityWrapper){nameEntity = detectedNameEntityWrapper.entity};

        if(nameEntity)
        {
            dataAccess.getTenantByName(nameEntity, function(err, doc){
                if(doc)
                {
                    var response = `${doc.name} is available at ${doc.malls}`;
                    session.endDialog(response);
                }
                else if(!doc)
                {
                    session.endDialog("Couldn't find that tenant");
                }
                else if(err)
                {
                    session.endDialog('Error connecting to database');
                }
            })
        }
        else
        {
            session.endDialog('No tenant name specified');
        }
    }
]);

//Dialog for tenant info
bot.dialog('/tenantInfoDialog', [
    function(session, args)
    {
        //Get LUIS intent and entity
        var intent = args.intent;
        var detectedCategoryEntityWrapper = builder.EntityRecognizer.findEntity(args.entities, 'Tenant::Category');
        var detectedTagEntityWrapper = builder.EntityRecognizer.findAllEntities(args.entities, 'Tenant::Tag');

        //Resolve entities
        var categoryEntity;
        if(detectedCategoryEntityWrapper){categoryEntity = detectedCategoryEntityWrapper.entity};
        var tagEntityList;
        if(detectedTagEntityWrapper)
        {
            tagEntityList = detectedTagEntityWrapper.map(function (tag){
                return tag.entity;
            });
        }

        if(categoryEntity && tagEntityList.length > 0)
        {
            console.dir(tagEntityList);
            var entities = {};
            entities.categoryEntity = categoryEntity;
            //Assuming only one tag
            entities.tagEntity = tagEntityList[0];

            session.beginDialog('/tenantCatTagDialog', entities);
        }
        else if(categoryEntity && tagEntityList.length == 0)
        {
            var entities = {};
            entities.categoryEntity = categoryEntity;
            session.beginDialog('/tenantCatDialog', entities);
        }
        else if(!categoryEntity && tagEntityList.length > 0)
        {
            var tags = {};
            tags.tagEntityList = tagEntityList;
            session.beginDialog('/tenantTagDialog', tags);
        }
        else
        {
            session.endDialog('No search criteria specified.');
        }
    }
]);

bot.dialog('/tenantCatTagDialog', [
    function(session, args)
    {
         dataAccess.getTenantInfo(args.categoryEntity, args.tagEntity, function(err, doc){
            if(doc.length > 0)
            {
                //Save result array
                session.dialogData.tenantResultList = doc;

                //Generate choice list
                var choiceList = generateTenantChoiceList(doc);
                builder.Prompts.choice(session, `We found these ${args.tagEntity}, ${args.categoryEntity} shops. Which one are you interested in?`, choiceList);
            }
            else if(doc.length == 0)
            {
                session.endDialog('Sorry, we can\'t find any shops that fulfill that criteria.');
            }
            else if(err)
            {
                session.endDialog('Error connecting to database.');
            }
        });
    },
    function(session, results)
    {
        var tenantResultList = session.dialogData.tenantResultList;
        var selectedChoice = results.response.entity;

        //Get the tenant information based on selected choice
        var tenant = getTenantWithSelectedChoice(tenantResultList, selectedChoice);
        
        //Respond with list of malls
        var response = generateMallResponse(tenant.name, tenant.malls);
        session.endDialog(response);
    }
]);

bot.dialog('/tenantCatDialog', [
    function(session, args)
    {
        dataAccess.getTenantInfoByCategory(args.categoryEntity, function(err, doc){
            if(doc.length > 0)
            {
                session.dialogData.tenantResultList = doc;

                var choiceList = generateTenantChoiceList(doc);
                builder.Prompts.choice(session, `We found these ${args.categoryEntity} shops. Which are you interested in?`, choiceList);
            }
            else if(doc.length == 0)
            {
                session.endDialog('Sorry, we can\'t find any shops that fulfill that critieria.');
            }
            else if(err)
            {
                session.endDialog('Error connecting to database.');
            }
        });
    },
    function(session, results)
    {
        var tenantResultList = session.dialogData.tenantResultList;
        var selectedChoice = results.response.entity;

        //Get the tenant information based on selected choice
        var tenant = getTenantWithSelectedChoice(tenantResultList, selectedChoice);
        
        //Respond with list of malls
        var response = generateMallResponse(tenant.name, tenant.malls);
        session.endDialog(response);
    }
]);

bot.dialog('/tenantTagDialog', [
    function(session,args,next)
    {
        session.dialogData.currentTags = args.tagEntityList;
        builder.Prompts.text(session, "Which mall are you looking for?");
    }, 
    function (session,args,results)
    {
        // User replied with a mall
        var currentMall = args.response;
        
        // Save current mall context temporarily
        session.dialogData.currentMall = currentMall;
         // Fetch categories by tag and mall
        dataAccess.getTenantInfoByTagAndMall(session.dialogData.currentTags, currentMall, function (err,doc){
            if(doc.length > 0)
            {
                //Save result array
                session.dialogData.tenantResultList = doc;
                //Get all categories that tenants map to
                var categoryList = generateCategoryChoiceList(session.dialogData.tenantResultList);
                session.dialogData.categoryList = categoryList;
                if (categoryList.length == 1)
                {
                    //Only one category
                    var tenantList = getTenantsByCategory(session.dialogData.tenantResultList, categoryList[0]);
                    session.endDialog("We found the following in " + currentMall + " for you: " + tenantList);
                } else
                {
                    //Multiple categories found for given tag
                    builder.Prompts.choice(session, 'What are you interested in?', categoryList);
                }
            }
            else if(doc.length == 0)
            {
                session.endDialog('Sorry, we can\'t find any shops that fulfill that criteria.');
            }
            else if(err)
            {
                session.endDialog('Error connecting to database.');
            }
        });
    },
    function (session,results){
        var selectedCategory = results.response.entity;
        tenantList = getTenantsByCategory(session.dialogData.tenantResultList, selectedCategory);
        session.endDialog("We found the following in " + session.dialogData.currentMall+ " for you: " + tenantList);
    }
]);

// Select all the tenants that are in the category the user specified
function getTenantsByCategory(fullTenantList, category){
    var tenantList = fullTenantList.map(function (tenant){
        if (tenant.category == category){
            return tenant.name;
        }
    });
    return tenantList;
}

function generateCategoryChoiceList(tenantResultList){
    var categoryChoiceList = [];
    tenantResultList.map(function (tenant) {
        if (categoryChoiceList.indexOf(tenant.category) == -1)
        {
            // Add category into choice list if it isn't already there
            categoryChoiceList.push(tenant.category);
        }
    });
    return categoryChoiceList;
}

function generateTenantChoiceList(tenantResultList)
{
    var tenantChoiceList = [];
    for(var i=0; i<tenantResultList.length; i++)
    {
        var tenantName = tenantResultList[i].name;
        tenantChoiceList.push(tenantName);
    }
    return tenantChoiceList;
}

function getTenantWithSelectedChoice(tenantResultList, selectedChoice)
{
    for(var i=0; i<tenantResultList.length; i++)
    {
        var tenantResult = tenantResultList[i];
        if(tenantResult.name.toLowerCase() == selectedChoice.toLowerCase())
        {
            return tenantResult;
        }
    }
}

function generateMallResponse(tenantName, mallList)
{
    var response = `${tenantName} is available in the malls `;
    
    for(var i=0; i<mallList.length; i++)
    {
        response += mallList[i];
        if(i != mallList.length-1)
        {
            response += ', ';
        }
    }

    return response;
}

/*
Utility functions
*/
function findSuperEntity(entities, superEntityType){
    for(var i=0; i<entities.length; i++)
    {
        var entity = entities[i];

        if(entity.type.startsWith(superEntityType)){
            return entity;
        }
    }
}   

