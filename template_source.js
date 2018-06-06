(function($){
    var eachTp='G.each({3},{4},function({1},{2}){G.add({2},{1});var $this={2};',
        varReg=/(\^*\$[.\w]+)|((["'])[^\3]+?\3)|(\^*[a-z]\w*)|(\d+)/gi,
        tpReg=/\[\[(.+?)\]\]/g,keyReg=/^(set|if|elseif|else|each|gdata|include|expr)(?:\s+(.+))?$/,
        RegInc=/\[\[include\s+(\S.+?)\]\]/g,RegAttr=/(\w+)=(''|""|(['"]?)(\d+|.+?)\3)/g,
        C='.zh-t';
    var _T={
        cnts:[],
        init:function(v){this.cnts=[[v]]},
        add:function(v,ev,m){this.cnts.push([v,ev,m]) },
        rm:function(){ this.cnts.pop() },
        each:function(obj,attr,fn){
            if(!obj) return;
            if(obj instanceof Array){
                attr.cond&&(obj=obj.filter(new Function('$value','with($value){ return '+ attr.cond +'}')));
                attr.sort&&(obj=obj.slice(0).sort(attr.sort));
                var n=Math.min(obj.length,attr.size||obj.length);
                for(var i=0;i<n;i++) fn(i,obj[i]);
            }else{
                for(var k in obj) fn(k,obj[k]);
            }
        },
        get:function(k,n){
            var cnts=this.cnts;
            var i=cnts.length,n=n||0;
            i=i<n?0:i-n;
            if(k=='$value') return cnts[i][0];
            if(k=='$index') return cnts[i][1];
            //console.info( 'get 0', i, k )
            while(i--){
                var o=cnts[i][0];
                if(!o) return "" ;
                if(/[\.\[\]]/.test(k )){
                	var v="";
                	try{
                		v=eval( 'o.' + k );
                		if( v!==undefined ) return v;
                	}catch(e){
                	}
                }else if( k in o ) 
                	return o[k];
                
               
            }
            return "";
        }
    }
    function toCode(str){
        return 'out.push("'+str.replace(/"/g,'\\"').replace(/[\r\n]/g,"\\n")+'");';
    }
    function toVar(str){
        return str.replace(varReg,function(_,a,b,c,d){
            if(d){
                var ms=d.match(/^(\^+)(.+)/),n=0;
                if(ms){
                    d=ms[2];
                    n=ms[1].length
                }
            }
            return d? ('G.get("'+d +'",'+n+')') :(a?(a=='$get'?'G.get':a  ):_);
        });
    }
    function getArgs(code){
        var re=[{},[]];
        code=code.replace(RegAttr,function(_,a,b){
            re[0][a]=b.replace(/^['"]|['"]$/g,'');
            return "";
        }).trim();
        re[1]=code.match(varReg);
        re[1]&&(re[1]=re[1].map(function(v){ return (v).replace(/^['"]|['"]$/g,'') }));
        return re;
    }
    function fmt(o,hold){
        return typeof (o) == 'object' ? this.replace(/\{(\w+)\}/g,function(_,k){
            return o[k] == null ? (hold ? _ : '') : o[k];
        }) : this.fmt(arguments);
    }
    var gidx=0;
    function gdata(code){
        var args=getArgs(code);
        return '(function(){ G.add($this=$.sPost("{0}"),null,{1});'.fmt(args[1][0],JSON.stringify(args[0]) );
    }
    function expr(code){
        return "with($this){ out.push("+ code +"); } ;";
    }
    function setV(code){
        var m=code.match(/(\w+)=(.+)/);
        return m? "with($this){$v['{1}']={2} };".fmt(m):"";
    }
    function parCmd(code){
        var re=null,c=code.charAt(0);
        if(re=code.match(keyReg)){
            var k=re[1];
            return k=="if"? ( "if("+ toVar(re[2]) +"){" ) :(
                k=="elseif"?("else if("+ toVar(re[2]) +"){"):(
                    k=="else"?"}else{":(
                        k=="gdata"?gdata(re[2]):(
                            k=="expr"? expr(re[2]):(k=='set'? setV(code):toVar(code))
                        )
                    )
                )
            )
        }else if(c=='#'){
        	code=code.trim();
        	var  i=code.indexOf(' '),_expr='';
        	if(i!=-1){
        		_expr=code.substring(1,i);
        		code=code.substring(i+1);
        	}else{
        		return  eachTp.fmt(0,'$index','$value', toVar( code.substring(1) ), '{}'  ) ;
        	}
		 
            var args=getArgs(code);
 
            return  eachTp.fmt(0,'$index','$value', toVar(_expr?_expr:  args[1][0]), JSON.stringify(args[0]) ) ;
            
        }else if(c=='/'){
            return  code=='/if'? '}':( code=='/gdata'?'})();G.rm();':'G.rm();});' ) ;
            //return  code=='/if'?'}':'G.rm();});'
        }else if(c=='?'){
            var cs=code.substr(1).trim().split(':');
            return  'out.push('+   toVar(cs[0])+'?'+ toVar(cs[1])+':' +toVar(cs[2]) +');';
        }else if(c=='@'){
            var i=code.indexOf('('),
                name=code.substring(1,i),args=toVar(code.substr(i));
            return 'out.push(ZhTemplate.fns["{0}"]?ZhTemplate.fns["{0}"]{1}:"");'.fmt(name,args );
        }else{
            return 'out.push('+toVar(code)+');' ;
        }
    }


    var fns={};
    window.ZhTemplate=$.extend(function (k,el,data){
        return fns[k];
    },{
        _tp:function(){
            $.extend(this,_T)
            this.cnts=[];
        },
        getCode:function(input){
            if(!input) return '';
            var si=0,re=null,cs=['var out=[],G=new $T._tp(),$v={};G.init($this);with(ZhTemplate.fns){'];
            while((re=tpReg.exec(input) ) != null){
                cs.push(
                    toCode(input.substring(si,re.index))
                );

                cs.push( parCmd(re[1]) );
                si=re.index + re[0].length;
            }
            var endStr=input.substring(si);
            endStr&&cs.push(toCode(endStr));
            cs.push(" } return out.join('');");
            //console.info(  cs.join('\n') );
            return cs.join('\n');
        },
        compile:function(key,code,el,data){
            var f=fns[key]=new Function("$this",this.getCode(code) );
            f.cfg={el:el,data:data,key:key};
            f.refresh=this.refresh;
            f.render=this.render;

        },
        loadTemplate:function(key,url){
            $.get(url,function(d){
                ZhTemplate.compile(key,d);
            })
        },
        refresh:function(el,data){
            var cfg=this.cfg;
            data&&(cfg.data=data);
            el&&(cfg.el=el);
            return this.render(cfg);
        },
        render:function(){
            var cfg={},args=arguments;
            if(args.length==1){
                cfg=args[0];
            }else if(args.length){
                cfg={
                    el:args[0],
                    key:args[1],
                    data:args[2],
                    cb:args[3]
                };
            }
            var f=$.isFunction(cfg.key)?cfg.key:fns[cfg.key];
            if(!f)return;
            f.cfg=cfg;
            var el=$(cfg.el);
            function out(html){
                el.prop('tagName')=='SCRIPT'? el.before(html) :el.html(html)
            };
            function write(k,d){ var html=f?f(d):'';out(html);cfg.cb&&cfg.cb(html)};
            if( typeof(cfg.data)=='string' ){
                if(cfg.data.match(/^[{[]/)){
                    try{var d=new Function("return  "+d.trim())()}catch(e){}
                    write(f,d);
                }else{
                    $.get(cfg.data,function(d){
                        if( typeof(d)=='string' ){
                            try{d=new Function("return  "+d.trim())()}catch(e){}
                        }
                        write(f,d);
                    });
                }
            }else{
                write(f,cfg.data);
            }
        },
        fns:{
            $cut:function(s,n,more){
                return (s+'').cut(n,more);
            },
            $len:function(s){return s instanceof Array?s.length: (s?(s+'').length:0)},
            $isEmpty:$.isEmptyObject,
            $format:function(s,f){
                return (parseFloat(s)||0).fmt(f);
            },
            $formatDate:function(s,f){
                var d=$.type(s)=='date'?s: (s+'').toDate();
                if(!d)return '';
                return (d).fmt(f);
            },
            $now:function(f){var d=new Date();return d.fmt(f)},
            $encode:function(s){ return encodeURIComponent(s)},
            $get:function(k,n){return this.get(k,n)},
            $case:function(){
                var kvs=arguments,val=kvs[0],L=kvs.length,i=1;
                while(i<L){
                    if( kvs[i]==val ) return kvs[i+1];
                    i+=2;
                }
                return L%2==0?kvs[L-1]:null;
            },
            $log:function(){console.log.apply(console,arguments);return '' }
        }
    });
    window.$T=ZhTemplate;
    $(function(){
        var ss=$('script[type="text/zht"]');
        ss.each(function(i){
            var s=$(this),data=s.attr('data'),
                id=s.attr('id'),el=s.attr('for'),code=this.innerHTML;
            if(this.src){code=$.sGet(this.src) }
            if(!id){
                id='_scpt'+i;
                s.attr('id',id);
            }
            ZhTemplate.compile(id,code,el,data);
            if(data ) ZhTemplate.render(el||this,id,data);
        });
        $(C).parseZht();
    });

    $.fn.parseZht=function(data){
        this.each(function () {
            if( $(this).is(C) ) {
                var tp=$(this).data(C);
                if(!tp) {
                    $(this).data(C,tp={});
                    var k='$e-'+this[jQuery.expando];
                    $T.compile(k,$(this).html().replace(/<!\-+|\-+>/g,'') );
                    tp.t=$T(k);
                    $(this).html('').show();
                }
                tp.t.refresh($(this), data);

            }else {
                $(this).find(C).parseZht(data);
            }

        })

    }
    if(!$('#zhtSty').length){
        document.write('<style id="zhtSty">.zh-t{ display:none }</style>');
    }
 
})(jQuery);